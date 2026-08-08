import { createHash, randomUUID } from "node:crypto";

import {
  cognitiveDelegationPolicySchema,
  cognitiveFounderPresentationSchema,
  cognitiveReviewArtifactSchema,
  cognitiveReviewInputSchema,
  cognitiveSpecialistArtifactSchema,
  cognitiveSpecialistInputSchema,
  cognitiveSynthesisInputSchema,
  cognitiveSynthesisSchema,
  cognitiveTransitionEventSchema,
  cognitiveTurnRequestSchema,
  cognitiveTurnSnapshotSchema,
  primaryIrisOrchestratorModel,
  requiredPresentationEvidence,
  validateCognitiveDelegation,
  type CognitiveDelegationEnvelope,
  type CognitiveDelegationPolicy,
  type CognitiveFounderPresentation,
  type CognitiveReviewArtifact,
  type CognitiveReviewInput,
  type CognitiveSpecialistArtifact,
  type CognitiveSpecialistInput,
  type CognitiveSynthesis,
  type CognitiveSynthesisInput,
  type CognitiveTransitionEvent,
  type CognitiveTurnPhase,
  type CognitiveTurnRequest,
  type CognitiveTurnSnapshot,
} from "./cognitive-turn-contracts.js";
import { CognitiveTurnError } from "./cognitive-turn-errors.js";
import { ModelLeaseScheduler } from "./model-lease-scheduler.js";
import { routeIrisModel, type IrisModelName, type ModelRoute } from "./model-router.js";

export interface CognitiveProviderAdapter {
  plan(
    input: CognitiveTurnRequest,
    model: IrisModelName,
    signal: AbortSignal,
  ): Promise<CognitiveDelegationEnvelope>;
  synthesize(
    input: CognitiveSynthesisInput,
    model: IrisModelName,
    signal: AbortSignal,
  ): Promise<CognitiveSynthesis>;
}

export interface CognitiveWorkerAdapter {
  execute(
    input: CognitiveSpecialistInput,
    signal: AbortSignal,
  ): Promise<CognitiveSpecialistArtifact>;
  review(input: CognitiveReviewInput, signal: AbortSignal): Promise<CognitiveReviewArtifact>;
}

export interface CognitiveTurnStore {
  load(requestId: string): Promise<CognitiveTurnSnapshot | null>;
  save(snapshot: CognitiveTurnSnapshot): Promise<void>;
}

export interface CognitiveTransitionSink {
  publish(event: CognitiveTransitionEvent): Promise<void>;
}

export interface CognitiveOrchestratorOptions {
  readonly provider: CognitiveProviderAdapter;
  readonly worker: CognitiveWorkerAdapter;
  readonly store: CognitiveTurnStore;
  readonly transitions: CognitiveTransitionSink;
  readonly leases: ModelLeaseScheduler;
  readonly now: () => string;
  readonly createUuid?: () => string;
}

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function sameRoute(actual: ModelRoute, expected: ModelRoute): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function completionFor(
  specialist: CognitiveSpecialistArtifact,
  review: CognitiveReviewArtifact,
): CognitiveFounderPresentation["completion"] {
  if (specialist.status === "passed" && review.verdict === "pass") return "completed";
  if (specialist.status === "failed") return "failed";
  return "blocked";
}

export interface FounderPresentationAssembly {
  readonly request: CognitiveTurnRequest;
  readonly synthesis: unknown;
  readonly specialist: CognitiveSpecialistArtifact;
  readonly review: CognitiveReviewArtifact;
  readonly degraded?: boolean;
}

export function assembleFounderPresentation(
  assembly: FounderPresentationAssembly,
): CognitiveFounderPresentation {
  let synthesis: CognitiveSynthesis;
  try {
    synthesis = cognitiveSynthesisSchema.parse(assembly.synthesis);
  } catch {
    throw new CognitiveTurnError("COGNITIVE_SYNTHESIS_INVALID");
  }
  const exactEvidence = requiredPresentationEvidence(assembly.specialist, assembly.review);
  const acknowledged = new Set(synthesis.acknowledgedEvidenceIds);
  if (exactEvidence.some(({ evidenceId }) => !acknowledged.has(evidenceId))) {
    throw new CognitiveTurnError("COGNITIVE_EVIDENCE_MISMATCH");
  }
  return cognitiveFounderPresentationSchema.parse({
    requestId: assembly.request.requestId,
    objectiveId: assembly.request.objectiveId,
    narrative: synthesis.narrative,
    completion: completionFor(assembly.specialist, assembly.review),
    exactEvidence,
    provenance: {
      orchestratorModel: primaryIrisOrchestratorModel,
      specialistModel: assembly.specialist.route.model,
      reviewerModel: assembly.review.reviewerModel,
    },
    degraded: assembly.degraded ?? false,
    authority: "none",
  });
}

export class CognitiveOrchestrator {
  readonly #provider: CognitiveProviderAdapter;
  readonly #worker: CognitiveWorkerAdapter;
  readonly #store: CognitiveTurnStore;
  readonly #transitions: CognitiveTransitionSink;
  readonly #leases: ModelLeaseScheduler;
  readonly #now: () => string;
  readonly #createUuid: () => string;

  constructor(options: CognitiveOrchestratorOptions) {
    this.#provider = options.provider;
    this.#worker = options.worker;
    this.#store = options.store;
    this.#transitions = options.transitions;
    this.#leases = options.leases;
    this.#now = options.now;
    this.#createUuid = options.createUuid ?? randomUUID;
  }

  state(requestId: string): Promise<CognitiveTurnSnapshot | null> {
    return this.#store.load(requestId);
  }

  async pause(requestId: string): Promise<CognitiveTurnSnapshot> {
    const current = await this.#requireState(requestId);
    if (this.#isTerminal(current.phase)) return current;
    const paused = await this.#transition(current, "paused", null, "Founder paused this turn.");
    await this.#leases.cancel(requestId);
    return paused;
  }

  async cancel(requestId: string): Promise<CognitiveTurnSnapshot> {
    const current = await this.#requireState(requestId);
    if (this.#isTerminal(current.phase)) return current;
    const cancelled = await this.#transition(
      current,
      "cancelled",
      null,
      "Founder cancelled this turn.",
    );
    await this.#leases.cancel(requestId);
    return cancelled;
  }

  async steer(requestId: string, note: string): Promise<CognitiveTurnSnapshot> {
    const current = await this.#requireState(requestId);
    if (this.#isTerminal(current.phase) || current.phase === "cancelled") return current;
    const safeNote = note
      .trim()
      .slice(0, 1_000)
      .replace(/\b(?:api[_ -]?key|password|secret|token)\b\s*[:=]\s*\S+/giu, "[REDACTED_SECRET]");
    if (safeNote.length === 0) throw new CognitiveTurnError("COGNITIVE_INVALID_TRANSITION");
    const next = cognitiveTurnSnapshotSchema.parse({
      ...current,
      generation: current.generation + 1,
      steeringNotes: [...current.steeringNotes, safeNote].slice(-10),
      updatedAt: this.#now(),
    });
    await this.#store.save(next);
    return next;
  }

  async resume(
    requestId: string,
    requestInput: CognitiveTurnRequest,
    policyInput: CognitiveDelegationPolicy,
  ): Promise<CognitiveTurnSnapshot> {
    const current = await this.#requireState(requestId);
    const request = cognitiveTurnRequestSchema.parse(requestInput);
    const policy = cognitiveDelegationPolicySchema.parse(policyInput);
    if (
      requestId !== request.requestId ||
      JSON.stringify(current.request) !== JSON.stringify(request) ||
      JSON.stringify(current.policy) !== JSON.stringify(policy)
    ) {
      throw new CognitiveTurnError("COGNITIVE_RESUME_BINDING_MISMATCH");
    }
    if (this.#isTerminal(current.phase) || current.phase === "cancelled") return current;
    if (current.route === null || current.delegation?.mode !== "delegated") {
      throw new CognitiveTurnError("COGNITIVE_RESUME_BINDING_MISMATCH");
    }
    if (current.specialistArtifact !== null && current.reviewArtifact !== null) {
      const resuming = await this.#transition(
        current,
        "orchestrator-synthesizing",
        primaryIrisOrchestratorModel,
        "Resuming from the last durable reviewed artifact.",
      );
      return this.#synthesizeValidated(
        resuming,
        current.route,
        current.specialistArtifact,
        current.reviewArtifact,
      );
    }
    return this.#runDelegated(current, current.route);
  }

  async start(
    requestInput: unknown,
    policyInput: unknown,
    signal?: AbortSignal,
  ): Promise<CognitiveTurnSnapshot> {
    const request = cognitiveTurnRequestSchema.parse(requestInput);
    const policy = cognitiveDelegationPolicySchema.parse(policyInput);
    if ((await this.#store.load(request.requestId)) !== null) {
      throw new CognitiveTurnError("COGNITIVE_RESUME_BINDING_MISMATCH");
    }
    try {
      return await this.#startBound(request, policy, signal);
    } catch (error) {
      const current = await this.#store.load(request.requestId);
      if (current === null) throw error;
      if (
        this.#isTerminal(current.phase) ||
        current.phase === "cancelled" ||
        current.phase === "paused"
      ) {
        return current;
      }
      const safeFailureCode =
        error instanceof CognitiveTurnError ? error.code : "COGNITIVE_ORCHESTRATOR_UNAVAILABLE";
      const failed = cognitiveTurnSnapshotSchema.parse({
        ...current,
        safeFailureCode,
        leaseEvents: this.#leases.events(),
        updatedAt: this.#now(),
      });
      return this.#transition(
        failed,
        "recovery-required",
        null,
        "The turn stopped at a durable recovery boundary.",
      );
    }
  }

  async #startBound(
    request: CognitiveTurnRequest,
    policy: CognitiveDelegationPolicy,
    signal?: AbortSignal,
  ): Promise<CognitiveTurnSnapshot> {
    let snapshot = cognitiveTurnSnapshotSchema.parse({
      request,
      policy,
      phase: "accepted",
      generation: 0,
      route: null,
      delegation: null,
      specialistArtifact: null,
      reviewArtifact: null,
      synthesisAttempts: 0,
      steeringNotes: [],
      transitionEvents: [],
      leaseEvents: [],
      presentation: null,
      safeFailureCode: null,
      updatedAt: this.#now(),
    });
    snapshot = await this.#transition(snapshot, "accepted", null, "Founder request accepted.");
    const route = routeIrisModel({
      utterance: request.utterance,
      availableModels: new Set(request.availableModels),
      hasImage: request.hasImage,
    });
    if (!request.availableModels.includes(primaryIrisOrchestratorModel)) {
      if (
        request.riskClass === "R0" &&
        request.availableModels.includes("qwen3:8b") &&
        (route.purpose === "conversation" || route.purpose === "fast-response")
      ) {
        return this.#runDegradedDialogue(snapshot, route, signal);
      }
      throw new CognitiveTurnError("COGNITIVE_ORCHESTRATOR_UNAVAILABLE", {
        retryable: true,
        safeDetails: { requiredModel: primaryIrisOrchestratorModel },
      });
    }
    snapshot = await this.#transition(
      snapshot,
      "orchestrator-planning",
      primaryIrisOrchestratorModel,
      "Qwen primary orchestration planning started.",
    );

    const planningEnvelope = await this.#leases.withLease(
      request.requestId,
      primaryIrisOrchestratorModel,
      "orchestrator-planning",
      (_lease, leaseSignal) =>
        this.#provider.plan(request, primaryIrisOrchestratorModel, leaseSignal),
      signal,
    );
    const planningControl = await this.#controlChangeSince(snapshot);
    if (planningControl !== null) return planningControl;
    const validated = validateCognitiveDelegation(planningEnvelope, request, route, policy);
    if (route.purpose === "fast-response" && validated.envelope.mode === "direct") {
      throw new CognitiveTurnError("COGNITIVE_ROUTE_MISMATCH");
    }
    snapshot = cognitiveTurnSnapshotSchema.parse({
      ...snapshot,
      route,
      delegation: validated.envelope,
      leaseEvents: this.#leases.events(),
      updatedAt: this.#now(),
    });
    snapshot = await this.#transition(
      snapshot,
      "delegation-validated",
      primaryIrisOrchestratorModel,
      "The delegation envelope and route were validated.",
    );

    if (validated.envelope.mode === "direct") {
      const presentation = cognitiveFounderPresentationSchema.parse({
        requestId: request.requestId,
        objectiveId: request.objectiveId,
        narrative: validated.envelope.narrative,
        completion: "completed",
        exactEvidence: [],
        provenance: {
          orchestratorModel: primaryIrisOrchestratorModel,
          specialistModel: null,
          reviewerModel: null,
        },
        degraded: false,
        authority: "none",
      });
      snapshot = cognitiveTurnSnapshotSchema.parse({
        ...snapshot,
        presentation,
        leaseEvents: this.#leases.events(),
        updatedAt: this.#now(),
      });
      return this.#transition(snapshot, "completed", null, "Direct dialogue completed.");
    }

    return this.#runDelegated(snapshot, validated.route, signal);
  }

  async #runDegradedDialogue(
    initial: CognitiveTurnSnapshot,
    route: ModelRoute,
    signal?: AbortSignal,
  ): Promise<CognitiveTurnSnapshot> {
    const request = initial.request;
    let snapshot = await this.#transition(
      initial,
      "degraded-interface",
      "qwen3:8b",
      "The primary orchestrator is unavailable; bounded R0 dialogue is degraded.",
    );
    const envelope = await this.#leases.withLease(
      request.requestId,
      "qwen3:8b",
      "degraded-interface",
      (_lease, leaseSignal) => this.#provider.plan(request, "qwen3:8b", leaseSignal),
      signal,
    );
    const control = await this.#controlChangeSince(snapshot);
    if (control !== null) return control;
    const validated = validateCognitiveDelegation(envelope, request, route, initial.policy);
    if (validated.envelope.mode !== "direct") {
      throw new CognitiveTurnError("COGNITIVE_ROUTE_MISMATCH");
    }
    const presentation = cognitiveFounderPresentationSchema.parse({
      requestId: request.requestId,
      objectiveId: request.objectiveId,
      narrative: `Degraded local interface: ${validated.envelope.narrative}`,
      completion: "completed",
      exactEvidence: [],
      provenance: {
        orchestratorModel: "qwen3:8b",
        specialistModel: null,
        reviewerModel: null,
      },
      degraded: true,
      authority: "none",
    });
    snapshot = cognitiveTurnSnapshotSchema.parse({
      ...snapshot,
      route,
      delegation: validated.envelope,
      presentation,
      leaseEvents: this.#leases.events(),
      updatedAt: this.#now(),
    });
    await this.#store.save(snapshot);
    return snapshot;
  }

  async #runDelegated(
    initial: CognitiveTurnSnapshot,
    route: ModelRoute,
    signal?: AbortSignal,
  ): Promise<CognitiveTurnSnapshot> {
    const request = initial.request;
    const delegation = initial.delegation;
    if (delegation?.mode !== "delegated") {
      throw new CognitiveTurnError("COGNITIVE_INVALID_TRANSITION");
    }

    let snapshot = await this.#transition(
      initial,
      "specialist-loading",
      route.model,
      "The selected specialist is loading.",
    );
    snapshot = await this.#transition(
      snapshot,
      "specialist-working",
      route.model,
      "Delegated specialist work started.",
    );
    const specialistInput = cognitiveSpecialistInputSchema.parse({
      requestId: request.requestId,
      objectiveId: request.objectiveId,
      objectiveDigest: request.objectiveDigest,
      repositoryScope: request.repositoryScope,
      pathScope: request.pathScope,
      capabilities: delegation.requestedCapabilities,
      route,
      steeringNotes: snapshot.steeringNotes,
      authority: "none",
    });
    const specialistOutput = await this.#leases.withLease(
      request.requestId,
      route.model,
      "specialist-working",
      (_lease, leaseSignal) => this.#worker.execute(specialistInput, leaseSignal),
      signal,
    );
    const specialistControl = await this.#controlChangeSince(snapshot);
    if (specialistControl !== null) return specialistControl;
    const specialist = cognitiveSpecialistArtifactSchema.parse(specialistOutput);
    this.#validateSpecialist(specialist, request, route);
    snapshot = cognitiveTurnSnapshotSchema.parse({
      ...snapshot,
      specialistArtifact: specialist,
      leaseEvents: this.#leases.events(),
      updatedAt: this.#now(),
    });
    snapshot = await this.#transition(
      snapshot,
      "verification-running",
      route.model,
      "Specialist output was bound and verification evidence recorded.",
    );

    const reviewerModel =
      route.purpose === "agentic-coding"
        ? request.availableModels.includes("gpt-oss:20b")
          ? "gpt-oss:20b"
          : null
        : route.independentReviewModel;
    if (reviewerModel === null || reviewerModel === route.model) {
      const unavailable = cognitiveTurnSnapshotSchema.parse({
        ...snapshot,
        safeFailureCode: "COGNITIVE_REVIEWER_UNAVAILABLE",
        updatedAt: this.#now(),
      });
      return this.#transition(
        unavailable,
        "reviewer-model-unavailable",
        null,
        "The required distinct reviewer model is unavailable.",
      );
    }
    snapshot = await this.#transition(
      snapshot,
      "independent-review",
      reviewerModel,
      "Independent review started.",
    );
    const reviewInput = cognitiveReviewInputSchema.parse({
      requestId: request.requestId,
      objectiveId: request.objectiveId,
      objectiveDigest: request.objectiveDigest,
      specialistArtifact: specialist,
      specialistArtifactDigest: specialist.artifactDigest,
      reviewerModel,
      acceptanceCriteria: [
        "The artifact remains bound to the exact objective and route.",
        "Required evidence supports the reported result.",
      ],
      authority: "none",
    });
    const reviewOutput = await this.#leases.withLease(
      request.requestId,
      reviewerModel,
      "independent-review",
      (_lease, leaseSignal) => this.#worker.review(reviewInput, leaseSignal),
      signal,
    );
    const reviewControl = await this.#controlChangeSince(snapshot);
    if (reviewControl !== null) return reviewControl;
    const review = cognitiveReviewArtifactSchema.parse(reviewOutput);
    this.#validateReview(review, request, specialist, reviewerModel);
    snapshot = cognitiveTurnSnapshotSchema.parse({
      ...snapshot,
      reviewArtifact: review,
      leaseEvents: this.#leases.events(),
      updatedAt: this.#now(),
    });
    snapshot = await this.#transition(
      snapshot,
      "orchestrator-synthesizing",
      primaryIrisOrchestratorModel,
      "Qwen primary synthesis started after independent review.",
    );
    return this.#synthesizeValidated(snapshot, route, specialist, review, signal);
  }

  async #synthesizeValidated(
    initial: CognitiveTurnSnapshot,
    route: ModelRoute,
    specialist: CognitiveSpecialistArtifact,
    review: CognitiveReviewArtifact,
    signal?: AbortSignal,
  ): Promise<CognitiveTurnSnapshot> {
    const request = initial.request;
    const exactEvidence = requiredPresentationEvidence(specialist, review);
    const synthesisInputBase = {
      requestId: request.requestId,
      objectiveId: request.objectiveId,
      objectiveDigest: request.objectiveDigest,
      route,
      specialistArtifact: specialist,
      reviewArtifact: review,
      evidence: exactEvidence.map(({ evidenceId, label, contentDigest }) => ({
        evidenceId,
        label,
        contentDigest,
      })),
      completionEligible: specialist.status === "passed" && review.verdict === "pass",
      steeringNotes: initial.steeringNotes,
      authority: "none",
    } as const;
    let snapshot = initial;
    let repairFailureCode: "COGNITIVE_EVIDENCE_MISMATCH" | "COGNITIVE_SYNTHESIS_INVALID" | null =
      null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const synthesisInput = cognitiveSynthesisInputSchema.parse({
        ...synthesisInputBase,
        repairFailureCode,
      });
      let presentation: CognitiveFounderPresentation;
      try {
        const providerOutput = await this.#leases.withLease(
          request.requestId,
          primaryIrisOrchestratorModel,
          "orchestrator-synthesizing",
          (_lease, leaseSignal) =>
            this.#provider.synthesize(synthesisInput, primaryIrisOrchestratorModel, leaseSignal),
          signal,
        );
        const synthesisControl = await this.#controlChangeSince(snapshot);
        if (synthesisControl !== null) return synthesisControl;
        presentation = assembleFounderPresentation({
          request,
          synthesis: providerOutput,
          specialist,
          review,
        });
      } catch (error) {
        const repairable =
          error instanceof CognitiveTurnError &&
          (error.code === "COGNITIVE_EVIDENCE_MISMATCH" ||
            error.code === "COGNITIVE_SYNTHESIS_INVALID");
        if (!repairable) throw error;
        repairFailureCode = error.code;
        snapshot = cognitiveTurnSnapshotSchema.parse({
          ...snapshot,
          synthesisAttempts: attempt,
          leaseEvents: this.#leases.events(),
          safeFailureCode: repairFailureCode,
          updatedAt: this.#now(),
        });
        await this.#store.save(snapshot);
        if (attempt === 2) {
          return this.#transition(
            snapshot,
            "synthesis-failed",
            null,
            "Qwen synthesis failed its bounded repair attempt.",
          );
        }
        continue;
      }

      snapshot = cognitiveTurnSnapshotSchema.parse({
        ...snapshot,
        synthesisAttempts: attempt,
        presentation,
        leaseEvents: this.#leases.events(),
        safeFailureCode: null,
        updatedAt: this.#now(),
      });
      return this.#transition(snapshot, "completed", null, "Delegated cognitive turn completed.");
    }
    throw new CognitiveTurnError("COGNITIVE_SYNTHESIS_INVALID");
  }

  async #requireState(requestId: string): Promise<CognitiveTurnSnapshot> {
    const current = await this.#store.load(requestId);
    if (current === null) throw new CognitiveTurnError("COGNITIVE_INVALID_TRANSITION");
    return cognitiveTurnSnapshotSchema.parse(current);
  }

  #isTerminal(phase: CognitiveTurnPhase): boolean {
    return phase === "completed" || phase === "cancelled" || phase === "degraded-interface";
  }

  async #controlChangeSince(
    captured: CognitiveTurnSnapshot,
  ): Promise<CognitiveTurnSnapshot | null> {
    const latest = await this.#requireState(captured.request.requestId);
    if (latest.generation === captured.generation) return null;
    if (
      latest.phase === "paused" ||
      latest.phase === "cancelled" ||
      this.#isTerminal(latest.phase)
    ) {
      return latest;
    }
    throw new CognitiveTurnError("COGNITIVE_INVALID_TRANSITION", {
      safeDetails: {
        expectedGeneration: captured.generation,
        actualGeneration: latest.generation,
      },
    });
  }

  #validateSpecialist(
    artifact: CognitiveSpecialistArtifact,
    request: CognitiveTurnRequest,
    route: ModelRoute,
  ): void {
    if (
      artifact.requestId !== request.requestId ||
      artifact.objectiveId !== request.objectiveId ||
      artifact.objectiveDigest !== request.objectiveDigest
    ) {
      throw new CognitiveTurnError("COGNITIVE_OBJECTIVE_BINDING_MISMATCH");
    }
    if (!sameRoute(artifact.route, route)) {
      throw new CognitiveTurnError("COGNITIVE_ROUTE_MISMATCH");
    }
  }

  #validateReview(
    review: CognitiveReviewArtifact,
    request: CognitiveTurnRequest,
    specialist: CognitiveSpecialistArtifact,
    reviewerModel: IrisModelName,
  ): void {
    if (
      review.requestId !== request.requestId ||
      review.objectiveId !== request.objectiveId ||
      review.objectiveDigest !== request.objectiveDigest ||
      review.specialistArtifactDigest !== specialist.artifactDigest
    ) {
      throw new CognitiveTurnError("COGNITIVE_OBJECTIVE_BINDING_MISMATCH");
    }
    if (review.reviewerModel !== reviewerModel) {
      throw new CognitiveTurnError("COGNITIVE_REVIEWER_UNAVAILABLE");
    }
  }

  async #transition(
    snapshot: CognitiveTurnSnapshot,
    phase: CognitiveTurnPhase,
    model: IrisModelName | null,
    reason: string,
  ): Promise<CognitiveTurnSnapshot> {
    const previous = snapshot.transitionEvents.at(-1) ?? null;
    const material = {
      eventId: `audit_${this.#createUuid()}`,
      requestId: snapshot.request.requestId,
      correlationId: snapshot.request.correlationId,
      sequence: snapshot.transitionEvents.length + 1,
      previousEventDigest: previous?.eventDigest ?? null,
      phase,
      model,
      reason,
      occurredAt: this.#now(),
    };
    const event = cognitiveTransitionEventSchema.parse({
      ...material,
      eventDigest: sha256(JSON.stringify(material)),
    });
    const next = cognitiveTurnSnapshotSchema.parse({
      ...snapshot,
      phase,
      generation: snapshot.generation + 1,
      transitionEvents: [...snapshot.transitionEvents, event],
      leaseEvents: this.#leases.events(),
      updatedAt: event.occurredAt,
    });
    await this.#store.save(next);
    await this.#transitions.publish(event);
    return next;
  }
}
