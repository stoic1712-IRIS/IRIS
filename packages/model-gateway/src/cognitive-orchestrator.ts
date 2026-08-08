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
    const route = routeIrisModel({
      utterance: request.utterance,
      availableModels: new Set(request.availableModels),
      hasImage: request.hasImage,
    });
    const validated = validateCognitiveDelegation(planningEnvelope, request, route, policy);
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
    const specialist = cognitiveSpecialistArtifactSchema.parse(
      await this.#leases.withLease(
        request.requestId,
        route.model,
        "specialist-working",
        (_lease, leaseSignal) => this.#worker.execute(specialistInput, leaseSignal),
        signal,
      ),
    );
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

    const reviewerModel = route.independentReviewModel;
    if (reviewerModel === null || reviewerModel === route.model) {
      throw new CognitiveTurnError("COGNITIVE_REVIEWER_UNAVAILABLE");
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
    const review = cognitiveReviewArtifactSchema.parse(
      await this.#leases.withLease(
        request.requestId,
        reviewerModel,
        "independent-review",
        (_lease, leaseSignal) => this.#worker.review(reviewInput, leaseSignal),
        signal,
      ),
    );
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
    const exactEvidence = requiredPresentationEvidence(specialist, review);
    const synthesisInput = cognitiveSynthesisInputSchema.parse({
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
      steeringNotes: snapshot.steeringNotes,
      repairFailureCode: null,
      authority: "none",
    });
    const synthesis = cognitiveSynthesisSchema.parse(
      await this.#leases.withLease(
        request.requestId,
        primaryIrisOrchestratorModel,
        "orchestrator-synthesizing",
        (_lease, leaseSignal) =>
          this.#provider.synthesize(synthesisInput, primaryIrisOrchestratorModel, leaseSignal),
        signal,
      ),
    );
    const missingEvidence = exactEvidence.filter(
      ({ evidenceId }) => !synthesis.acknowledgedEvidenceIds.includes(evidenceId),
    );
    if (missingEvidence.length > 0) {
      throw new CognitiveTurnError("COGNITIVE_EVIDENCE_MISMATCH");
    }
    const presentation = cognitiveFounderPresentationSchema.parse({
      requestId: request.requestId,
      objectiveId: request.objectiveId,
      narrative: synthesis.narrative,
      completion: completionFor(specialist, review),
      exactEvidence,
      provenance: {
        orchestratorModel: primaryIrisOrchestratorModel,
        specialistModel: route.model,
        reviewerModel,
      },
      degraded: false,
      authority: "none",
    });
    snapshot = cognitiveTurnSnapshotSchema.parse({
      ...snapshot,
      synthesisAttempts: 1,
      presentation,
      leaseEvents: this.#leases.events(),
      updatedAt: this.#now(),
    });
    return this.#transition(snapshot, "completed", null, "Delegated cognitive turn completed.");
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
