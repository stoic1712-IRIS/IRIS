import {
  cognitiveDelegationEnvelopeSchema,
  cognitiveDelegationPolicySchema,
  cognitiveReviewArtifactSchema,
  cognitiveSpecialistArtifactSchema,
  cognitiveSynthesisSchema,
  cognitiveTurnRequestSchema,
  cognitiveTurnSnapshotSchema,
  exactEvidenceReferenceSchema,
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
const artifactDigest = `sha256:${"c".repeat(64)}`;
const evidenceDigest = `sha256:${"d".repeat(64)}`;
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

export function exactEvidence(
  overrides: Partial<ExactEvidenceReference> = {},
): ExactEvidenceReference {
  return exactEvidenceReferenceSchema.parse({
    evidenceId: requiredEvidenceId,
    kind: "artifact",
    label: "Verified worker artifact",
    exactValue: "artifact://candidate/verified",
    contentDigest: evidenceDigest,
    requiredInPresentation: true,
    ...overrides,
  });
}

function specialistRoute(model: IrisModelName) {
  const request = model === "gpt-oss:20b" ? researchRequest() : codingRequest();
  return routeIrisModel({
    utterance: request.utterance,
    availableModels: new Set(request.availableModels),
    hasImage: request.hasImage,
  });
}

export function passedSpecialistArtifact(
  model: IrisModelName,
  evidence: ExactEvidenceReference[] = [exactEvidence()],
): CognitiveSpecialistArtifact {
  return cognitiveSpecialistArtifactSchema.parse({
    requestId,
    objectiveId,
    objectiveDigest,
    route: specialistRoute(model),
    status: "passed",
    summary: "The bounded specialist work and verification passed.",
    evidence,
    artifactDigest,
    occurredAt: fixedTimestamp,
    authority: "none",
  });
}

export function passingReview(
  model: IrisModelName,
  evidence: ExactEvidenceReference[] = [exactEvidence()],
): CognitiveReviewArtifact {
  return cognitiveReviewArtifactSchema.parse({
    requestId,
    objectiveId,
    objectiveDigest,
    specialistArtifactDigest: artifactDigest,
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

class MemoryStore implements CognitiveTurnStore {
  readonly #snapshots = new Map<string, CognitiveTurnSnapshot>();

  load(id: string): Promise<CognitiveTurnSnapshot | null> {
    const value = this.#snapshots.get(id);
    return Promise.resolve(value === undefined ? null : cognitiveTurnSnapshotSchema.parse(value));
  }

  save(snapshot: CognitiveTurnSnapshot): Promise<void> {
    this.#snapshots.set(snapshot.request.requestId, cognitiveTurnSnapshotSchema.parse(snapshot));
    return Promise.resolve();
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

function makeUuidFactory(): () => string {
  let sequence = 0;
  return () => {
    sequence += 1;
    return `0198a6d2-0000-7000-8000-${sequence.toString(16).padStart(12, "0")}`;
  };
}

export function cognitiveHarness(
  options: CognitiveHarnessOptions = {},
  suppliedStore?: CognitiveTurnStore,
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
      return Promise.resolve(configuredSpecialist);
    },
    review(input, signal) {
      void signal;
      workerState.calls.push("review");
      workerState.reviewerModels.push(input.reviewerModel);
      workerState.reviewCalls += 1;
      return Promise.resolve(configuredReview);
    },
  };
  const store = suppliedStore ?? new MemoryStore();
  const lifecycle = new RecordingLifecycle();
  const transitions: CognitiveTransitionEvent[] = [];
  const leases = new ModelLeaseScheduler(lifecycle, () => fixedTimestamp);
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
  const base = cognitiveHarness();
  const worker = base.worker as DelayedSpecialistHarness["worker"];
  worker.started = Promise.resolve();
  worker.resolve = (artifact) => {
    void artifact;
  };
  return { ...base, worker };
}

export function restartHarnessThatFailsBeforeSynthesis(): CognitiveHarness {
  return cognitiveHarness({ failBeforeSynthesis: true });
}

export function restartedHarness(store: CognitiveTurnStore): CognitiveHarness {
  return cognitiveHarness({}, store);
}
