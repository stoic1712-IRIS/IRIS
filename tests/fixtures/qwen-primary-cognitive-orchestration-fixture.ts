import {
  cognitiveDelegationEnvelopeSchema,
  cognitiveDelegationPolicySchema,
  cognitiveReviewArtifactSchema,
  cognitiveSpecialistArtifactSchema,
  cognitiveSynthesisSchema,
  cognitiveTurnRequestSchema,
  cognitiveTurnSnapshotSchema,
  exactEvidenceContentDigest,
  exactEvidenceReferenceSchema,
  specialistArtifactContentDigest,
  type CognitiveDelegationEnvelope,
  type CognitiveDelegationPolicy,
  type CognitiveReviewArtifact,
  type CognitiveSpecialistArtifact,
  type CognitiveSynthesis,
  type CognitiveTransitionEvent,
  type CognitiveTurnRequest,
  type CognitiveTurnSnapshot,
  type ExactEvidenceReference,
} from "../../packages/model-gateway/src/cognitive-turn-contracts.js";
import {
  CognitiveOrchestrator,
  type CognitiveProviderAdapter,
  type CognitiveTurnStore,
  type CognitiveWorkerAdapter,
} from "../../packages/model-gateway/src/cognitive-orchestrator.js";
import {
  ModelLeaseScheduler,
  type ModelLease,
  type ModelLeaseJournal,
  type ModelLifecycleAdapter,
} from "../../packages/model-gateway/src/model-lease-scheduler.js";
import {
  routeIrisModel,
  type IrisModelName,
} from "../../packages/model-gateway/src/model-router.js";

const objectiveId = "objective_0198a6cf-7c74-7ae0-8f8d-92c13db44d7a";
const requestId = "request_0198a6d0-07ca-7b32-a021-98b267ca44ef";
const fixedTimestamp = "2026-08-08T21:39:25.124Z";
const objectiveDigest = `sha256:${"a".repeat(64)}`;
const approvedModels: IrisModelName[] = [
  "qwen3:8b",
  "qwen3.6:27b",
  "gpt-oss:20b",
  "qwen3-coder:30b",
];

export const requiredEvidenceId = "evidence_0198a6d1-5969-7983-a3c2-8468cff0be10";

export function conversationRequest(
  overrides: Partial<CognitiveTurnRequest> = {},
): CognitiveTurnRequest {
  return cognitiveTurnRequestSchema.parse({
    requestId,
    correlationId: requestId,
    sessionId: "founder_session_0198a6d0-51ac-7cc0-b10b-42f16616dc84",
    objectiveId,
    objectiveDigest,
    utterance: "Hello, IRIS.",
    riskClass: "R0",
    repositoryScope: [],
    pathScope: [],
    availableModels: approvedModels,
    hasImage: false,
    occurredAt: fixedTimestamp,
    ...overrides,
  });
}

export function codingRequest(overrides: Partial<CognitiveTurnRequest> = {}): CognitiveTurnRequest {
  return conversationRequest({
    utterance: "Refactor this TypeScript repository and run the test suite.",
    riskClass: "R2",
    repositoryScope: ["stoic1712-IRIS/IRIS"],
    pathScope: ["packages/model-gateway/src/**", "tests/**"],
    ...overrides,
  });
}

export function researchRequest(
  overrides: Partial<CognitiveTurnRequest> = {},
): CognitiveTurnRequest {
  return conversationRequest({
    utterance: "Research the current Node.js release and verify authoritative sources.",
    riskClass: "R1",
    ...overrides,
  });
}

export function fastResponseRequest(
  overrides: Partial<CognitiveTurnRequest> = {},
): CognitiveTurnRequest {
  return conversationRequest({
    utterance: "Give me a quick answer.",
    riskClass: "R0",
    ...overrides,
  });
}

export function policy(allowedCapabilities: string[]): CognitiveDelegationPolicy {
  return cognitiveDelegationPolicySchema.parse({
    allowedCapabilities,
    protectedEffectStop: false,
    requiredReviewPurposes: ["agentic-coding", "deep-reasoning", "research-review"],
  });
}

export function codingPolicy(): CognitiveDelegationPolicy {
  return policy(["repository.inspect", "repository.edit-bounded"]);
}

export function directEnvelope(narrative: string): CognitiveDelegationEnvelope {
  return cognitiveDelegationEnvelopeSchema.parse({
    mode: "direct",
    objectiveId,
    objectiveDigest,
    narrative,
    requestedCapabilities: [],
    specialistPurpose: null,
    authority: "none",
  });
}

export function codingEnvelope(): CognitiveDelegationEnvelope {
  return cognitiveDelegationEnvelopeSchema.parse({
    mode: "delegated",
    objectiveId,
    objectiveDigest,
    requestedCapabilities: ["repository.inspect", "repository.edit-bounded"],
    specialistPurpose: "agentic-coding",
    rationale: "The objective requires bounded repository implementation.",
    authority: "none",
  });
}

export function researchEnvelope(): CognitiveDelegationEnvelope {
  return cognitiveDelegationEnvelopeSchema.parse({
    mode: "delegated",
    objectiveId,
    objectiveDigest,
    requestedCapabilities: ["research.search", "research.verify-source"],
    specialistPurpose: "research-review",
    rationale: "The objective requires source retrieval and verification.",
    authority: "none",
  });
}

export function fastResponseEnvelope(): CognitiveDelegationEnvelope {
  return cognitiveDelegationEnvelopeSchema.parse({
    mode: "delegated",
    objectiveId,
    objectiveDigest,
    requestedCapabilities: ["conversation.fast"],
    specialistPurpose: "fast-response",
    rationale: "The objective requests a bounded fast response.",
    authority: "none",
  });
}

export function exactEvidence(
  overrides: Partial<ExactEvidenceReference> = {},
): ExactEvidenceReference {
  const exactValue = overrides.exactValue ?? "artifact://candidate/verified";
  return exactEvidenceReferenceSchema.parse({
    evidenceId: requiredEvidenceId,
    kind: "artifact",
    label: "Verified worker artifact",
    exactValue,
    contentDigest: overrides.contentDigest ?? exactEvidenceContentDigest(exactValue),
    requiredInPresentation: true,
    ...overrides,
  });
}

function specialistRoute(model: IrisModelName) {
  const request =
    model === "gpt-oss:20b"
      ? researchRequest()
      : model === "qwen3:8b"
        ? fastResponseRequest()
        : codingRequest();
  return routeIrisModel({
    utterance: request.utterance,
    availableModels: new Set(request.availableModels),
    hasImage: request.hasImage,
  });
}

export function passedSpecialistArtifact(
  model: IrisModelName,
  evidence: ExactEvidenceReference[] = [exactEvidence()],
  // The artifact's bound route must equal the orchestrator's enforced route, so a test whose
  // request routes by resolved capabilities rather than by the fixture's default keyword
  // utterance supplies the matching route explicitly.
  route: ReturnType<typeof routeIrisModel> = specialistRoute(model),
): CognitiveSpecialistArtifact {
  const material = {
    requestId,
    objectiveId,
    objectiveDigest,
    route,
    status: "passed",
    summary: "The bounded specialist work and verification passed.",
    evidence,
    occurredAt: fixedTimestamp,
    authority: "none",
  } as const;
  return cognitiveSpecialistArtifactSchema.parse({
    ...material,
    artifactDigest: specialistArtifactContentDigest(material),
  });
}

export function passingReview(
  model: IrisModelName,
  evidence: ExactEvidenceReference[] = [exactEvidence()],
  specialistArtifactDigest?: string,
): CognitiveReviewArtifact {
  const specialistModel = model === "qwen3.6:27b" ? "gpt-oss:20b" : "qwen3-coder:30b";
  return cognitiveReviewArtifactSchema.parse({
    requestId,
    objectiveId,
    objectiveDigest,
    specialistArtifactDigest:
      specialistArtifactDigest ??
      passedSpecialistArtifact(specialistModel, evidence).artifactDigest,
    reviewerModel: model,
    verdict: "pass",
    findings: [],
    evidence,
    occurredAt: fixedTimestamp,
    authority: "none",
  });
}

export function synthesis(acknowledgedEvidenceIds: string[]): CognitiveSynthesis {
  return cognitiveSynthesisSchema.parse({
    narrative: "The independently reviewed result is ready for the Founder.",
    acknowledgedEvidenceIds,
    authority: "none",
  });
}

export interface CognitiveHarnessOptions {
  planningEnvelope?: CognitiveDelegationEnvelope;
  specialist?: CognitiveSpecialistArtifact;
  review?: CognitiveReviewArtifact;
  synthesis?: CognitiveSynthesis;
  synthesisSequence?: CognitiveSynthesis[];
  failBeforeSynthesis?: boolean;
}

export interface CognitiveHarness {
  runtime: CognitiveOrchestrator;
  store: CognitiveTurnStore;
  provider: { models: IrisModelName[]; planningCalls: number; synthesisCalls: number };
  worker: {
    calls: string[];
    models: IrisModelName[];
    reviewerModels: IrisModelName[];
    specialistCalls: number;
    reviewCalls: number;
  };
  lifecycle: { maximumConcurrent: number };
  transitions: CognitiveTransitionEvent[];
}

export interface DelayedSpecialistHarness extends CognitiveHarness {
  worker: CognitiveHarness["worker"] & {
    started: Promise<void>;
    resolve: (artifact: CognitiveSpecialistArtifact) => void;
  };
}

export interface DelayedPlanningHarness extends CognitiveHarness {
  provider: CognitiveHarness["provider"] & {
    started: Promise<void>;
    resolve: (envelope: CognitiveDelegationEnvelope) => void;
  };
}

export class MemoryStore implements CognitiveTurnStore {
  readonly #snapshots = new Map<string, CognitiveTurnSnapshot>();

  load(id: string): Promise<CognitiveTurnSnapshot | null> {
    const value = this.#snapshots.get(id);
    return Promise.resolve(value === undefined ? null : cognitiveTurnSnapshotSchema.parse(value));
  }

  compareAndSet(
    snapshot: CognitiveTurnSnapshot,
    expectedGeneration: number | null,
  ): Promise<boolean> {
    const current = this.#snapshots.get(snapshot.request.requestId);
    const actualGeneration = current?.generation ?? null;
    if (actualGeneration !== expectedGeneration) return Promise.resolve(false);
    this.#snapshots.set(snapshot.request.requestId, cognitiveTurnSnapshotSchema.parse(snapshot));
    return Promise.resolve(true);
  }
}

class RecordingLifecycle implements ModelLifecycleAdapter {
  active = 0;
  maximumConcurrent = 0;

  acquire(
    request: string,
    model: IrisModelName,
    signal: AbortSignal,
  ): Promise<{ leaseId: string; acquiredAt: string }> {
    if (signal.aborted) return Promise.reject(signal.reason as Error);
    this.active += 1;
    this.maximumConcurrent = Math.max(this.maximumConcurrent, this.active);
    return Promise.resolve({ leaseId: `${request}-${model}`, acquiredAt: fixedTimestamp });
  }

  release(
    lease: ModelLease,
    reason: "completed" | "failed" | "cancelled",
  ): Promise<{ releasedAt: string }> {
    void lease;
    void reason;
    this.active -= 1;
    return Promise.resolve({ releasedAt: fixedTimestamp });
  }
}

class MemoryLeaseJournal implements ModelLeaseJournal {
  active: ModelLease | null = null;

  loadActive(): Promise<ModelLease | null> {
    return Promise.resolve(this.active);
  }

  append(
    event: import("../../packages/model-gateway/src/cognitive-turn-contracts.js").ModelLeaseEvent,
  ): Promise<void> {
    if (event.type === "acquired") {
      this.active = {
        requestId: event.requestId,
        leaseId: event.leaseId,
        model: event.model,
        phase: event.phase,
        acquiredAt: event.occurredAt,
      };
    } else if (event.type === "released") {
      this.active = null;
    }
    return Promise.resolve();
  }
}

function makeUuidFactory(): () => string {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `0198a6d2-0000-7000-8000-${sequence.toString(16).padStart(12, "0")}`;
  };
}

interface DelayedControl {
  readonly specialist: Promise<CognitiveSpecialistArtifact>;
  readonly markStarted: () => void;
}

interface DelayedPlanningControl {
  readonly planning: Promise<CognitiveDelegationEnvelope>;
  readonly markStarted: () => void;
}

export function cognitiveHarness(
  options: CognitiveHarnessOptions = {},
  suppliedStore?: CognitiveTurnStore,
): CognitiveHarness {
  return createHarness(options, suppliedStore);
}

function createHarness(
  options: CognitiveHarnessOptions,
  suppliedStore?: CognitiveTurnStore,
  delayed?: DelayedControl,
  delayedPlanning?: DelayedPlanningControl,
): CognitiveHarness {
  const providerState = { models: [] as IrisModelName[], planningCalls: 0, synthesisCalls: 0 };
  const workerState = {
    calls: [] as string[],
    models: [] as IrisModelName[],
    reviewerModels: [] as IrisModelName[],
    specialistCalls: 0,
    reviewCalls: 0,
  };
  const configuredSpecialist = options.specialist ?? passedSpecialistArtifact("qwen3-coder:30b");
  const configuredReview = options.review ?? passingReview("gpt-oss:20b");
  const synthesisQueue = [
    ...(options.synthesisSequence ?? []),
    ...(options.synthesis === undefined ? [] : [options.synthesis]),
  ];
  if (synthesisQueue.length === 0) synthesisQueue.push(synthesis([requiredEvidenceId]));

  const provider: CognitiveProviderAdapter = {
    plan(input, model, signal) {
      void input;
      void signal;
      providerState.models.push(model);
      providerState.planningCalls += 1;
      if (delayedPlanning !== undefined) {
        delayedPlanning.markStarted();
        return delayedPlanning.planning;
      }
      return Promise.resolve(options.planningEnvelope ?? codingEnvelope());
    },
    synthesize(input, model, signal) {
      void input;
      void signal;
      if (options.failBeforeSynthesis) return Promise.reject(new Error("restart-boundary"));
      providerState.models.push(model);
      providerState.synthesisCalls += 1;
      return Promise.resolve(synthesisQueue.shift() ?? synthesis([]));
    },
  };
  const worker: CognitiveWorkerAdapter = {
    execute(input, signal) {
      void signal;
      workerState.calls.push("execute");
      workerState.models.push(input.route.model);
      workerState.specialistCalls += 1;
      if (delayed !== undefined) {
        delayed.markStarted();
        return delayed.specialist;
      }
      return Promise.resolve(
        options.specialist === undefined
          ? (() => {
              const routed = { ...configuredSpecialist, route: input.route };
              return cognitiveSpecialistArtifactSchema.parse({
                ...routed,
                artifactDigest: specialistArtifactContentDigest(routed),
              });
            })()
          : configuredSpecialist,
      );
    },
    review(input, signal) {
      void signal;
      workerState.calls.push("review");
      workerState.reviewerModels.push(input.reviewerModel);
      workerState.reviewCalls += 1;
      return Promise.resolve(
        options.review === undefined
          ? cognitiveReviewArtifactSchema.parse({
              ...configuredReview,
              specialistArtifactDigest: input.specialistArtifactDigest,
              reviewerModel: input.reviewerModel,
            })
          : configuredReview,
      );
    },
  };
  const store = suppliedStore ?? new MemoryStore();
  const lifecycle = new RecordingLifecycle();
  const transitions: CognitiveTransitionEvent[] = [];
  const leases = new ModelLeaseScheduler(lifecycle, () => fixedTimestamp, new MemoryLeaseJournal());
  const runtime = new CognitiveOrchestrator({
    provider,
    worker,
    store,
    transitions: {
      publish(event) {
        transitions.push(event);
        return Promise.resolve();
      },
    },
    leases,
    now: () => fixedTimestamp,
    createUuid: makeUuidFactory(),
  });
  return { runtime, store, provider: providerState, worker: workerState, lifecycle, transitions };
}

export function delayedSpecialistHarness(): DelayedSpecialistHarness {
  let markStarted!: () => void;
  let resolveArtifact!: (artifact: CognitiveSpecialistArtifact) => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const specialist = new Promise<CognitiveSpecialistArtifact>((resolve) => {
    resolveArtifact = resolve;
  });
  const base = createHarness({}, undefined, { specialist, markStarted });
  const worker = base.worker as DelayedSpecialistHarness["worker"];
  worker.started = started;
  worker.resolve = (artifact) => {
    resolveArtifact(artifact);
  };
  return { ...base, worker };
}

export function delayedPlanningHarness(): DelayedPlanningHarness {
  let markStarted!: () => void;
  let resolveEnvelope!: (envelope: CognitiveDelegationEnvelope) => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const planning = new Promise<CognitiveDelegationEnvelope>((resolve) => {
    resolveEnvelope = resolve;
  });
  const base = createHarness({}, undefined, undefined, { planning, markStarted });
  const provider = base.provider as DelayedPlanningHarness["provider"];
  provider.started = started;
  provider.resolve = (envelope) => {
    resolveEnvelope(envelope);
  };
  return { ...base, provider };
}

export function restartHarnessThatFailsBeforeSynthesis(): CognitiveHarness {
  return cognitiveHarness({ failBeforeSynthesis: true });
}

export function restartedHarness(store: CognitiveTurnStore): CognitiveHarness {
  return cognitiveHarness({}, store);
}
