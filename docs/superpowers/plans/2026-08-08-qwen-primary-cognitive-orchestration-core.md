# Qwen Primary Cognitive Orchestration Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an IRIS-owned cognitive coordinator that makes `qwen3.6:27b` the normal Founder-facing orchestrator and communicator while preserving the existing specialist router, workers, authority gates, exact evidence, and rollback paths.

**Architecture:** The Core tranche adds strict cognitive-turn contracts, deterministic delegation validation, a single-active-model lease scheduler, and a resumable coordinator around the existing `routeIrisModel` function. Provider output remains untrusted: Core validates Qwen's proposal, executes specialists through injected adapters, requires distinct review when policy says so, preserves exact evidence outside model prose, and lets Qwen author only the bounded narrative. The Founder Command Center is a separate dependent subsystem and receives its own plan only after this Core tranche is merged and an exact Core revision can be bound.

**Tech Stack:** TypeScript 5.9, Node.js 24, Zod 4.4, Vitest 4.1, the existing `@stoic-iris/contracts` primitives, and the existing `@stoic-iris/model-gateway` package.

## Global Constraints

- Bound Core base: `6367e4547d34092472c672ee93a9e1b2a8e5c80f`.
- Preserve `routeIrisModel`, `ModelRoute`, every current model name, every current worker contract, and all existing capabilities.
- Fix the primary orchestrator model to `qwen3.6:27b` for this tranche.
- Preserve `qwen3-coder:30b` for coding, `gpt-oss:20b` for deep reasoning/research review/independent review, and `qwen3:8b` for fast work plus a clearly disclosed R0-only degraded interface.
- IRIS Core remains the sole owner of identity, canonical memory, governance, authority, approvals, audit, evidence, routing, and worker state.
- Treat every Qwen delegation, specialist result, reviewer result, and synthesis as untrusted provider output until strict validation succeeds.
- Never let model prose recreate exact URLs, citations, hashes, approvals, command results, review findings, commit identifiers, or rollback evidence; Core attaches those immutable fields.
- Permit only one active model lease at a time on the RTX 3090; persist a checkpoint before changing the active large model.
- Preserve pause, cancellation, steering, restart, recovery, expiry, and access-revocation semantics; late provider results cannot overwrite a newer terminal state.
- Do not add a model, dependency, lockfile change, paid service, credential, deployment, public exposure, or LAN exposure.
- Do not add GODEL in this tranche.
- Do not claim permanent Phase 0 graduation; this is additive capability work.
- The Command Center tranche must bind the exact merged Core revision and must not begin from this feature-branch commit.
- Use exact-path staging only. Never use `git add .`, `git add -A`, force-push, destructive reset, or history rewriting.

## File Map

**Create**

- `packages/model-gateway/src/cognitive-turn-contracts.ts` — strict provider-independent schemas and exported types for requests, proposals, artifacts, reviews, synthesis, presentations, events, policies, and snapshots.
- `packages/model-gateway/src/cognitive-turn-errors.ts` — typed fail-closed cognitive and lease errors with safe metadata only.
- `packages/model-gateway/src/model-lease-scheduler.ts` — single-active-model lease ownership, transition events, cancellation, release, and cleanup.
- `packages/model-gateway/src/cognitive-orchestrator.ts` — deterministic direct/delegated state machine using injected planning, worker, review, synthesis, store, clock, identifier, and lease dependencies.
- `tests/qwen-primary-cognitive-orchestration-contracts.test.ts` — strict-schema, scope, capability, route, override, fallback, and compatibility tests.
- `tests/model-lease-scheduler.test.ts` — exclusivity, event ordering, cancellation, failure, and release tests.
- `tests/qwen-primary-cognitive-orchestration-runtime.test.ts` — direct dialogue, delegation, review, exact evidence, bounded repair, pause, cancel, steering, resume, and late-result tests.
- `tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts` — deterministic requests, policies, evidence, fake adapters, persistent store, delayed effects, and restart harnesses shared by the runtime tests.
- `docs/specifications/qwen-primary-cognitive-orchestration.md` — canonical implementation behavior after Founder approval and merge.
- `evidence/model-routing/qwen-primary-cognitive-orchestration-2026-08-08.md` — exact commands, exit codes, changed paths, limitations, and rollback evidence.
- `.iris/coordination/handoffs/qwen-primary-cognitive-orchestration-core.json` — schema-valid producer handoff for independent review.

**Modify**

- `packages/model-gateway/src/index.ts:1-6` — export the four new Core modules without changing existing exports.

**Existing planning artifacts**

- `docs/superpowers/specs/2026-08-08-qwen-primary-cognitive-orchestration-design.md` — approved design; do not rewrite it during implementation.
- `docs/superpowers/plans/2026-08-08-qwen-primary-cognitive-orchestration-core.md` — this plan; preserve it with the implementation branch before runtime changes begin.

**Preserve unchanged**

- `packages/model-gateway/src/model-router.ts` — remains the deterministic specialist selector.
- `packages/model-gateway/src/founder-dialogue.ts` — remains a compatibility path until the separately bound Command Center tranche.
- `packages/model-gateway/src/ollama-adapter.ts` — remains the provider adapter; live lifecycle wiring belongs to the Command Center tranche.
- `package.json`, `pnpm-lock.yaml`, and every dependency manifest.

## Execution Preconditions

Implementation must not begin until all of the following are true:

1. The canonical Core checkout still resolves `main` to `6367e4547d34092472c672ee93a9e1b2a8e5c80f` or a reviewed descendant that contains no conflicting model-gateway change.
2. An approved task exists at `.iris/coordination/tasks/qwen-primary-cognitive-orchestration-core.json`, binds the exact base revision and branch, and permits only the paths in this plan.
3. `iris-dev task validate` passes for that task.
4. The isolated worktree is clean except for the approved design and plan documents.
5. No dependency installation or provider operation is needed for deterministic Core work.

---

### Task 1: Define strict cognitive-turn and delegation contracts

**Files:**

- Create: `packages/model-gateway/src/cognitive-turn-contracts.ts`
- Create: `packages/model-gateway/src/cognitive-turn-errors.ts`
- Create: `tests/qwen-primary-cognitive-orchestration-contracts.test.ts`

**Interfaces:**

- Consumes: `canonicalIdSchema`, `riskClassSchema`, `sha256DigestSchema`, and `timestampSchema` from `@stoic-iris/contracts`; `irisModelNameSchema`, `modelRoutePurposeSchema`, and `type ModelRoute` from `./model-router.js`.
- Produces: `cognitiveTurnRequestSchema`, `cognitiveDelegationEnvelopeSchema`, `cognitiveDelegationPolicySchema`, `cognitiveSpecialistArtifactSchema`, `cognitiveReviewArtifactSchema`, `cognitiveSynthesisSchema`, `cognitiveFounderPresentationSchema`, `cognitiveTurnSnapshotSchema`, `validateCognitiveDelegation`, `requiredPresentationEvidence`, and `CognitiveTurnError`.

- [ ] **Step 1: Write failing strict-contract tests**

```ts
import { describe, expect, it } from "vitest";

import {
  cognitiveTurnRequestSchema,
  validateCognitiveDelegation,
} from "../packages/model-gateway/src/cognitive-turn-contracts.js";
import { routeIrisModel } from "../packages/model-gateway/src/model-router.js";

const objectiveId = "objective_0198a6cf-7c74-7ae0-8f8d-92c13db44d7a";
const requestId = "request_0198a6d0-07ca-7b32-a021-98b267ca44ef";
const digest = `sha256:${"a".repeat(64)}`;
const allModels = new Set(["qwen3:8b", "qwen3.6:27b", "gpt-oss:20b", "qwen3-coder:30b"]);

function request() {
  return cognitiveTurnRequestSchema.parse({
    requestId,
    correlationId: requestId,
    sessionId: "founder_session_0198a6d0-51ac-7cc0-b10b-42f16616dc84",
    objectiveId,
    objectiveDigest: digest,
    utterance: "Refactor this TypeScript repository and run the test suite.",
    riskClass: "R2",
    repositoryScope: ["stoic1712-IRIS/IRIS"],
    pathScope: ["packages/model-gateway/src/**", "tests/**"],
    availableModels: [...allModels],
    hasImage: false,
    occurredAt: "2026-08-08T21:39:25.124Z",
  });
}

describe("Qwen primary cognitive contracts", () => {
  it("rejects extra fields and objective-binding drift", () => {
    expect(() => cognitiveTurnRequestSchema.parse({ ...request(), extra: true })).toThrow();
    const route = routeIrisModel({ utterance: request().utterance, availableModels: allModels });
    expect(() => validateCognitiveDelegation({
      mode: "delegated",
      objectiveId,
      objectiveDigest: `sha256:${"b".repeat(64)}`,
      requestedCapabilities: ["repository.inspect", "repository.edit-bounded"],
      specialistPurpose: "agentic-coding",
      rationale: "The objective requires repository implementation.",
      authority: "none",
    }, request(), route, {
      allowedCapabilities: ["repository.inspect", "repository.edit-bounded"],
      protectedEffectStop: false,
      requiredReviewPurposes: ["agentic-coding", "deep-reasoning", "research-review"],
    })).toThrow("COGNITIVE_OBJECTIVE_BINDING_MISMATCH");
  });

  it("accepts only registered capabilities and the deterministic specialist purpose", () => {
    const input = request();
    const route = routeIrisModel({ utterance: input.utterance, availableModels: allModels });
    const validated = validateCognitiveDelegation({
      mode: "delegated",
      objectiveId,
      objectiveDigest: digest,
      requestedCapabilities: ["repository.inspect", "repository.edit-bounded"],
      specialistPurpose: "agentic-coding",
      rationale: "The objective requires repository implementation.",
      authority: "none",
    }, input, route, {
      allowedCapabilities: ["repository.inspect", "repository.edit-bounded"],
      protectedEffectStop: false,
      requiredReviewPurposes: ["agentic-coding", "deep-reasoning", "research-review"],
    });
    expect(validated.route).toEqual(route);
    expect(validated.requiresIndependentReview).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

```powershell
$env:COREPACK_ENABLE_NETWORK = '0'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-contracts.test.ts
```

Expected: exit code `1` because `cognitive-turn-contracts.ts` does not exist.

- [ ] **Step 3: Implement the exported contract surface**

Use strict Zod objects and these exact discriminants:

```ts
export const primaryIrisOrchestratorModel = "qwen3.6:27b" as const;
export const degradedIrisDialogueModel = "qwen3:8b" as const;

export const cognitiveTurnModeSchema = z.enum(["direct", "delegated"]);
export const cognitiveTurnPhaseSchema = z.enum([
  "accepted", "orchestrator-planning", "delegation-validated", "specialist-loading",
  "specialist-working", "verification-running", "independent-review",
  "orchestrator-synthesizing", "completed", "paused", "cancelled",
  "recovery-required", "reviewer-model-unavailable", "synthesis-failed", "degraded-interface",
]);

export const exactEvidenceReferenceSchema = z.object({
  evidenceId: canonicalIdSchema.refine((value) => value.startsWith("evidence_")),
  kind: z.enum(["artifact", "citation", "command-result", "approval", "digest", "review", "rollback"]),
  label: z.string().min(1).max(300),
  exactValue: z.string().min(1).max(20_000),
  contentDigest: sha256DigestSchema,
  requiredInPresentation: z.boolean(),
}).strict();

export const cognitiveTurnRequestSchema = z.object({
  requestId: canonicalIdSchema.refine((value) => value.startsWith("request_")),
  correlationId: canonicalIdSchema,
  sessionId: z.string().regex(/^founder_session_[0-9a-f-]{36}$/u),
  objectiveId: canonicalIdSchema.refine((value) => value.startsWith("objective_")),
  objectiveDigest: sha256DigestSchema,
  utterance: z.string().trim().min(1).max(6_000),
  riskClass: riskClassSchema,
  repositoryScope: z.array(z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)).max(8),
  pathScope: z.array(z.string().min(1).max(500)).max(100),
  availableModels: z.array(irisModelNameSchema).min(1).max(4),
  hasImage: z.boolean().default(false),
  occurredAt: timestampSchema,
}).strict();

export const cognitiveDelegationEnvelopeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("direct"), objectiveId: canonicalIdSchema, objectiveDigest: sha256DigestSchema,
    narrative: z.string().trim().min(1).max(6_000), requestedCapabilities: z.tuple([]),
    specialistPurpose: z.null(), authority: z.literal("none"),
  }).strict(),
  z.object({
    mode: z.literal("delegated"), objectiveId: canonicalIdSchema, objectiveDigest: sha256DigestSchema,
    requestedCapabilities: z.array(z.string().min(1).max(200)).min(1).max(16),
    specialistPurpose: modelRoutePurposeSchema, rationale: z.string().trim().min(1).max(1_000),
    authority: z.literal("none"),
  }).strict(),
]);
```

Define the remaining schemas with the same strictness:

- `cognitiveDelegationPolicySchema`: `allowedCapabilities`, `protectedEffectStop`, and `requiredReviewPurposes`.
- `cognitiveSpecialistArtifactSchema`: exact request/objective binding, selected `ModelRoute`, `status` (`passed`, `failed`, `blocked`), bounded summary, immutable evidence references, artifact digest, timestamp, and `authority: "none"`.
- `cognitiveReviewArtifactSchema`: exact specialist digest, distinct reviewer model, verdict (`pass`, `revise`, `block`), bounded findings, immutable evidence, timestamp, and `authority: "none"`.
- `cognitiveSpecialistInputSchema`: the exact request/objective binding, validated capabilities, Core-owned route, bounded steering notes, and no approval or execution authority.
- `cognitiveReviewInputSchema`: exact request/objective binding, immutable specialist artifact/digest, required distinct reviewer model, and bounded acceptance criteria.
- `cognitiveSynthesisInputSchema`: exact request/objective binding, validated specialist/review state, evidence IDs/labels/digests without mutable exact values, completion eligibility, and bounded steering notes.
- `cognitiveSynthesisSchema`: bounded `narrative`, unique `acknowledgedEvidenceIds`, and `authority: "none"`; it carries no exact evidence values.
- `cognitiveFounderPresentationSchema`: Core-authored completion status, narrative, exact evidence references, orchestrator/specialist/reviewer provenance, and `authority: "none"`.
- `cognitiveTransitionEventSchema`: event ID, request/correlation IDs, one-based sequence, optional previous digest, exact phase, optional model, bounded reason, timestamp, and event digest.
- `cognitiveTurnSnapshotSchema`: request, phase, generation, route, durable artifacts, synthesis attempt count, steering notes, digest-linked transition events, lease events, presentation, safe failure code, and `updatedAt`.

Implement `validateCognitiveDelegation` in this order: parse inputs; require exact objective ID and digest; require `authority: "none"`; require unique allowlisted capabilities; honor `protectedEffectStop`; restrict healthy-primary direct mode to conversation/vision; require delegated purpose to equal the deterministic route; derive independent review only from policy. The coordinator owns the separately labeled R0 degraded exception in Task 6.

Extend the contract test with explicit failures for duplicate capabilities, an unregistered capability, `protectedEffectStop: true`, a mismatched specialist purpose, a direct envelope for coding, and an extra field on every provider-produced envelope.

Implement `CognitiveTurnError` with these exact codes:

```ts
export const cognitiveTurnErrorCodes = [
  "COGNITIVE_OBJECTIVE_BINDING_MISMATCH", "COGNITIVE_CAPABILITY_NOT_ALLOWED",
  "COGNITIVE_PROTECTED_EFFECT_STOP", "COGNITIVE_ROUTE_MISMATCH",
  "COGNITIVE_INVALID_TRANSITION", "COGNITIVE_REVIEWER_UNAVAILABLE",
  "COGNITIVE_EVIDENCE_MISMATCH", "COGNITIVE_SYNTHESIS_INVALID",
  "COGNITIVE_TURN_CANCELLED", "COGNITIVE_RESUME_BINDING_MISMATCH",
  "COGNITIVE_ORCHESTRATOR_UNAVAILABLE", "COGNITIVE_SPECIALIST_UNAVAILABLE",
  "MODEL_LEASE_CONFLICT", "MODEL_LEASE_RELEASE_FAILED",
] as const;
```

Expose only `code`, `retryable`, and a frozen safe-details record.

- [ ] **Step 4: Run the contract and existing router tests**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-contracts.test.ts tests/model-router.test.ts
```

Expected: exit code `0`; every current router expectation remains unchanged.

- [ ] **Step 5: Commit the contract slice locally**

```powershell
git add -- packages/model-gateway/src/cognitive-turn-contracts.ts packages/model-gateway/src/cognitive-turn-errors.ts tests/qwen-primary-cognitive-orchestration-contracts.test.ts
git commit -m "feat: define IRIS cognitive orchestration contracts"
```

---

### Task 2: Enforce sequential model leases

**Files:**

- Create: `packages/model-gateway/src/model-lease-scheduler.ts`
- Create: `tests/model-lease-scheduler.test.ts`

**Interfaces:**

- Consumes: `IrisModelName`, `CognitiveTurnError`, request identifiers, timestamps, and `AbortSignal`.
- Produces: `ModelLifecycleAdapter`, `ModelLease`, `ModelLeaseEvent`, `ModelLeaseScheduler`, `withLease`, `cancel`, `activeLease`, and `events`.

- [ ] **Step 1: Write failing exclusivity, release, and cancellation tests**

```ts
it("never overlaps Qwen, specialist, reviewer, and synthesis leases", async () => {
  const lifecycle = new RecordingLifecycle();
  const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock);
  await scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-planning", async () => "planned");
  await scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", async () => "built");
  await scheduler.withLease(requestId, "gpt-oss:20b", "independent-review", async () => "reviewed");
  await scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-synthesizing", async () => "done");
  expect(lifecycle.maximumConcurrent).toBe(1);
  expect(scheduler.activeLease()).toBeNull();
});

it("aborts the active effect and still attempts release", async () => {
  const lifecycle = new RecordingLifecycle();
  const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock);
  const running = scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-planning", (_lease, signal) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })),
  );
  await scheduler.cancel(requestId);
  await expect(running).rejects.toThrow();
  expect(lifecycle.released).toEqual(["qwen3.6:27b"]);
  expect(scheduler.activeLease()).toBeNull();
});
```

Define the inline test fixture before the tests:

```ts
const requestId = "request_0198a6d0-07ca-7b32-a021-98b267ca44ef";
const fixedClock = () => "2026-08-08T21:39:25.124Z";

class RecordingLifecycle implements ModelLifecycleAdapter {
  active = 0;
  maximumConcurrent = 0;
  released: IrisModelName[] = [];

  acquire(_requestId: string, model: IrisModelName): Promise<{ leaseId: string; acquiredAt: string }> {
    this.active += 1;
    this.maximumConcurrent = Math.max(this.maximumConcurrent, this.active);
    return Promise.resolve({ leaseId: `lease-${model}`, acquiredAt: fixedClock() });
  }

  release(lease: ModelLease): Promise<{ releasedAt: string }> {
    this.released.push(lease.model);
    this.active -= 1;
    return Promise.resolve({ releasedAt: fixedClock() });
  }
}
```

- [ ] **Step 2: Run the focused lease test and confirm failure**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/model-lease-scheduler.test.ts
```

Expected: exit code `1` because the scheduler module does not exist.

- [ ] **Step 3: Implement the provider-independent lifecycle**

```ts
export interface ModelLifecycleAdapter {
  acquire(requestId: string, model: IrisModelName, signal: AbortSignal): Promise<{ leaseId: string; acquiredAt: string }>;
  release(lease: ModelLease, reason: "completed" | "failed" | "cancelled"): Promise<{ releasedAt: string }>;
}

export interface ModelLease {
  readonly requestId: string;
  readonly leaseId: string;
  readonly model: IrisModelName;
  readonly phase: CognitiveTurnPhase;
  readonly acquiredAt: string;
}

export class ModelLeaseScheduler {
  constructor(lifecycle: ModelLifecycleAdapter, now: () => string);
  async withLease<Result>(requestId: string, model: IrisModelName, phase: CognitiveTurnPhase,
    effect: (lease: ModelLease, signal: AbortSignal) => Promise<Result>, outerSignal?: AbortSignal): Promise<Result>;
  cancel(requestId: string): Promise<void>;
  activeLease(): ModelLease | null;
  events(): readonly ModelLeaseEvent[];
}
```

Refuse overlapping acquisition; combine internal and caller cancellation; record acquisition only after provider confirmation; execute once; release in `finally`; record release only after provider confirmation; preserve truthful release-failure evidence; cancel only the exact active request; expose metadata-only immutable events.

- [ ] **Step 4: Run lease, adapter, and router tests**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/model-lease-scheduler.test.ts tests/model-gateway-ollama.test.ts tests/model-router.test.ts
```

Expected: exit code `0` and no Ollama transport change.

- [ ] **Step 5: Commit the lease slice locally**

```powershell
git add -- packages/model-gateway/src/model-lease-scheduler.ts tests/model-lease-scheduler.test.ts
git commit -m "feat: add sequential model lease scheduler"
```

---

### Task 3: Implement direct and delegated cognitive turns

**Files:**

- Create: `packages/model-gateway/src/cognitive-orchestrator.ts`
- Create: `tests/qwen-primary-cognitive-orchestration-runtime.test.ts`
- Create: `tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts`

**Interfaces:**

- Consumes: Task 1 contracts, `routeIrisModel`, `ModelLeaseScheduler`, and injected adapters.
- Produces: `CognitiveProviderAdapter`, `CognitiveWorkerAdapter`, `CognitiveTurnStore`, `CognitiveTransitionSink`, `CognitiveOrchestrator`, `start`, and `state`.
- Test fixture produces: `conversationRequest`, `codingRequest`, `researchRequest`, `policy`, `codingPolicy`, `directEnvelope`, `codingEnvelope`, `researchEnvelope`, `exactEvidence`, `passedSpecialistArtifact`, `passingReview`, `synthesis`, `requiredEvidenceId`, `cognitiveHarness`, `delayedSpecialistHarness`, `restartHarnessThatFailsBeforeSynthesis`, and `restartedHarness`.

- [ ] **Step 1: Write failing direct and delegated runtime tests**

```ts
it("uses Qwen 27B directly for ordinary dialogue without a specialist", async () => {
  const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
  const result = await harness.runtime.start(conversationRequest(), policy(["conversation"]));
  expect(result.phase).toBe("completed");
  expect(result.presentation?.narrative).toBe("Hello, Founder.");
  expect(harness.provider.models).toEqual(["qwen3.6:27b"]);
  expect(harness.worker.calls).toHaveLength(0);
});

it("delegates coding, obtains distinct GPT-OSS review, then returns through Qwen", async () => {
  const harness = cognitiveHarness({
    planningEnvelope: codingEnvelope(),
    specialist: passedSpecialistArtifact("qwen3-coder:30b"),
    review: passingReview("gpt-oss:20b"),
    synthesis: synthesis([requiredEvidenceId]),
  });
  const result = await harness.runtime.start(codingRequest(), policy(["repository.inspect", "repository.edit-bounded"]));
  expect(result.presentation?.provenance).toEqual({
    orchestratorModel: "qwen3.6:27b", specialistModel: "qwen3-coder:30b", reviewerModel: "gpt-oss:20b",
  });
  expect(harness.provider.models).toEqual(["qwen3.6:27b", "qwen3.6:27b"]);
  expect(harness.worker.models).toEqual(["qwen3-coder:30b"]);
  expect(harness.worker.reviewerModels).toEqual(["gpt-oss:20b"]);
});
```

Create the fixture module with this exact exported surface. Every builder must return the corresponding strict schema's parsed value, use the fixed IDs/timestamp from Task 1, and default to all four approved models:

```ts
export const requiredEvidenceId = "evidence_0198a6d1-5969-7983-a3c2-8468cff0be10";
export function conversationRequest(overrides: Partial<CognitiveTurnRequest> = {}): CognitiveTurnRequest;
export function codingRequest(overrides: Partial<CognitiveTurnRequest> = {}): CognitiveTurnRequest;
export function researchRequest(overrides: Partial<CognitiveTurnRequest> = {}): CognitiveTurnRequest;
export function policy(allowedCapabilities: string[]): CognitiveDelegationPolicy;
export function codingPolicy(): CognitiveDelegationPolicy;
export function directEnvelope(narrative: string): CognitiveDelegationEnvelope;
export function codingEnvelope(): CognitiveDelegationEnvelope;
export function researchEnvelope(): CognitiveDelegationEnvelope;
export function exactEvidence(overrides: Partial<ExactEvidenceReference> = {}): ExactEvidenceReference;
export function passedSpecialistArtifact(model: IrisModelName, evidence?: ExactEvidenceReference[]): CognitiveSpecialistArtifact;
export function passingReview(model: IrisModelName, evidence?: ExactEvidenceReference[]): CognitiveReviewArtifact;
export function synthesis(acknowledgedEvidenceIds: string[]): CognitiveSynthesis;
export function cognitiveHarness(options?: CognitiveHarnessOptions): CognitiveHarness;
export function delayedSpecialistHarness(): DelayedSpecialistHarness;
export function restartHarnessThatFailsBeforeSynthesis(): CognitiveHarness;
export function restartedHarness(store: CognitiveTurnStore): CognitiveHarness;
```

Use these exact fixture shapes:

```ts
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
```

The harness uses in-memory injected adapters that parse every configured result through its strict schema, shift configured synthesis results in order, retain snapshots across a supplied store, and never call Ollama, Git, the network, or the filesystem. `failBeforeSynthesis` throws only after a validated review snapshot has been saved.

- [ ] **Step 2: Run the runtime test and confirm failure**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-runtime.test.ts
```

Expected: exit code `1` because `cognitive-orchestrator.ts` does not exist.

- [ ] **Step 3: Implement injected runtime boundaries**

```ts
export interface CognitiveProviderAdapter {
  plan(input: CognitiveTurnRequest, model: IrisModelName, signal: AbortSignal): Promise<CognitiveDelegationEnvelope>;
  synthesize(input: CognitiveSynthesisInput, model: IrisModelName, signal: AbortSignal): Promise<CognitiveSynthesis>;
}

export interface CognitiveWorkerAdapter {
  execute(input: CognitiveSpecialistInput, signal: AbortSignal): Promise<CognitiveSpecialistArtifact>;
  review(input: CognitiveReviewInput, signal: AbortSignal): Promise<CognitiveReviewArtifact>;
}

export interface CognitiveTurnStore {
  load(requestId: string): Promise<CognitiveTurnSnapshot | null>;
  save(snapshot: CognitiveTurnSnapshot): Promise<void>;
}

export interface CognitiveTransitionSink {
  publish(event: CognitiveTransitionEvent): Promise<void>;
}
```

`start` must reject a duplicate request; save `accepted`; checkpoint before every provider call; plan through Qwen; calculate the authoritative `ModelRoute` with `new Set(request.availableModels)`; validate the Qwen envelope; complete direct conversation or vision without a specialist; execute delegated work once; require and validate a distinct reviewer; checkpoint before Qwen synthesis; validate evidence; set completion from Core state rather than prose; save before publishing each transition. A healthy-primary `fast-response` route delegates to Qwen 8B and returns through Qwen 27B; direct Qwen 8B is reserved for the degraded R0 path in Task 6. Transition events are one-based, SHA-256 linked, bound to the request/correlation IDs, and saved before they are emitted.

- [ ] **Step 4: Run direct, delegated, lease, and router tests**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-runtime.test.ts tests/model-lease-scheduler.test.ts tests/model-router.test.ts
```

Expected: exit code `0` with event order planning, specialist, review, synthesis, completed.

- [ ] **Step 5: Commit the runtime happy path locally**

```powershell
git add -- packages/model-gateway/src/cognitive-orchestrator.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts
git commit -m "feat: orchestrate Qwen and specialist cognitive turns"
```

---

### Task 4: Preserve exact evidence and bound synthesis repair

**Files:**

- Modify: `packages/model-gateway/src/cognitive-turn-contracts.ts`
- Modify: `packages/model-gateway/src/cognitive-orchestrator.ts`
- Modify: `tests/qwen-primary-cognitive-orchestration-runtime.test.ts`
- Modify: `tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts`

**Interfaces:**

- Consumes: Task 1 evidence references and Task 3 synthesis flow.
- Produces: `requiredPresentationEvidence`, `assembleFounderPresentation`, and one bounded synthesis repair attempt.

- [ ] **Step 1: Add failing evidence-preservation tests**

```ts
it("attaches exact evidence unchanged instead of asking Qwen to reproduce it", async () => {
  const exact = exactEvidence({
    kind: "citation",
    exactValue: "https://nodejs.org/en/about/previous-releases",
    requiredInPresentation: true,
  });
  const harness = cognitiveHarness({
    planningEnvelope: researchEnvelope(),
    specialist: passedSpecialistArtifact("gpt-oss:20b", [exact]),
    review: passingReview("qwen3.6:27b", [exact]),
    synthesis: {
      narrative: "The official release table supports the finding.",
      acknowledgedEvidenceIds: [exact.evidenceId],
      authority: "none",
    },
  });
  const result = await harness.runtime.start(
    researchRequest(),
    policy(["research.search", "research.verify-source"]),
  );
  expect(result.presentation?.exactEvidence).toEqual([exact]);
});

it("allows one synthesis repair and then preserves evidence in synthesis-failed state", async () => {
  const harness = cognitiveHarness({ synthesisSequence: [synthesis([]), synthesis([])] });
  const result = await harness.runtime.start(
    codingRequest(),
    policy(["repository.inspect", "repository.edit-bounded"]),
  );
  expect(result.phase).toBe("synthesis-failed");
  expect(result.synthesisAttempts).toBe(2);
  expect(result.specialistArtifact?.evidence).not.toHaveLength(0);
  expect(result.presentation).toBeNull();
});
```

- [ ] **Step 2: Run the focused runtime test and confirm the new assertions fail**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-runtime.test.ts
```

Expected: exit code `1` because exact evidence assembly and bounded repair are not complete.

- [ ] **Step 3: Implement exact evidence assembly**

`requiredPresentationEvidence` returns the de-duplicated immutable evidence set from specialist and reviewer artifacts where `requiredInPresentation` is true. Reject the same `evidenceId` carrying different content or digest.

`assembleFounderPresentation` must:

1. Parse the synthesis.
2. Require its acknowledgement set to contain every required evidence ID exactly once.
3. Attach the original evidence objects without string reconstruction.
4. Set Core-owned `completion` from validated worker/review state.
5. Attach exact orchestrator, specialist, and reviewer model provenance.
6. Set `authority: "none"`.

When the first synthesis fails only evidence acknowledgement or output validation, call Qwen once more with the missing evidence IDs and the safe error code. A second failure saves `synthesis-failed`, preserves validated artifacts, releases the lease, and never fabricates a completion message.

- [ ] **Step 4: Run evidence, runtime, and secret-filter coverage**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-runtime.test.ts tests/model-gateway-ollama.test.ts tests/cycle-five-founder-dialogue.test.ts
```

Expected: exit code `0`; exact values remain byte-for-byte equal and secret detection remains active.

- [ ] **Step 5: Commit the evidence slice locally**

```powershell
git add -- packages/model-gateway/src/cognitive-turn-contracts.ts packages/model-gateway/src/cognitive-orchestrator.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts
git commit -m "feat: preserve exact cognitive evidence"
```

---

### Task 5: Make pause, cancel, steering, and recovery resumable

**Files:**

- Modify: `packages/model-gateway/src/cognitive-turn-contracts.ts`
- Modify: `packages/model-gateway/src/cognitive-orchestrator.ts`
- Modify: `tests/qwen-primary-cognitive-orchestration-runtime.test.ts`
- Modify: `tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts`

**Interfaces:**

- Consumes: persisted `CognitiveTurnSnapshot`, the lease scheduler, and injected store/transition sink.
- Produces: `pause`, `cancel`, `steer`, `resume`, exact generation checks, and recovery states.

- [ ] **Step 1: Add failing interruption and restart tests**

```ts
it("keeps cancellation terminal when a non-cooperative specialist returns late", async () => {
  const harness = delayedSpecialistHarness();
  const running = harness.runtime.start(
    codingRequest(),
    policy(["repository.inspect", "repository.edit-bounded"]),
  );
  await harness.worker.started;
  const cancelled = await harness.runtime.cancel(codingRequest().requestId);
  harness.worker.resolve(passedSpecialistArtifact("qwen3-coder:30b"));
  await running;
  expect(cancelled.phase).toBe("cancelled");
  expect((await harness.runtime.state(codingRequest().requestId))?.phase).toBe("cancelled");
  expect(harness.provider.synthesisCalls).toBe(0);
});

it("resumes from the last durable artifact without repeating completed model calls", async () => {
  const first = restartHarnessThatFailsBeforeSynthesis();
  const stopped = await first.runtime.start(
    codingRequest(),
    policy(["repository.inspect", "repository.edit-bounded"]),
  );
  expect(stopped.phase).toBe("recovery-required");
  const second = restartedHarness(first.store);
  const completed = await second.runtime.resume(
    codingRequest().requestId,
    codingRequest(),
    policy(["repository.inspect", "repository.edit-bounded"]),
  );
  expect(completed.phase).toBe("completed");
  expect(second.worker.specialistCalls).toBe(0);
  expect(second.worker.reviewCalls).toBe(0);
  expect(second.provider.synthesisCalls).toBe(1);
});
```

Also test that pause saves terminal control state before abort; steering cannot widen objective/repository/path/authority binding; resume rejects changed request or policy; access revocation cannot become recovery success; and provider/release failures preserve prior exact evidence.

- [ ] **Step 2: Run the focused runtime test and confirm interruption failures**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-runtime.test.ts
```

Expected: exit code `1` until interruption methods and generation guards exist.

- [ ] **Step 3: Implement durable generation and resume rules**

Use these exact methods:

```ts
state(requestId: string): Promise<CognitiveTurnSnapshot | null>;
pause(requestId: string): Promise<CognitiveTurnSnapshot>;
cancel(requestId: string): Promise<CognitiveTurnSnapshot>;
steer(requestId: string, note: string): Promise<CognitiveTurnSnapshot>;
resume(
  requestId: string,
  request: CognitiveTurnRequest,
  policy: CognitiveDelegationPolicy,
): Promise<CognitiveTurnSnapshot>;
```

Reload the latest snapshot before applying any provider result; compare the captured generation; save pause/cancel before abort; increment generation on control changes; retain at most ten secret-filtered steering notes; bind resume to the exact serialized request and policy; resume from the last durable delegation/artifact/review/synthesis stage; convert restored active phases to `recovery-required`; and return completed/cancelled snapshots unchanged.

- [ ] **Step 4: Run runtime, goal-orchestration, and delivery recovery tests**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-runtime.test.ts tests/cycle-nine-goal-multi-agent-orchestration.test.ts tests/cycle-eleven-complete-software-delivery.test.ts
```

Expected: exit code `0`; the coordinator follows existing terminal-cancellation and exact-resume principles.

- [ ] **Step 5: Commit the recovery slice locally**

```powershell
git add -- packages/model-gateway/src/cognitive-turn-contracts.ts packages/model-gateway/src/cognitive-orchestrator.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts tests/fixtures/qwen-primary-cognitive-orchestration-fixture.ts
git commit -m "feat: add resumable cognitive turn control"
```

---

### Task 6: Enforce fallback, reviewer, override, and compatibility behavior

**Files:**

- Modify: `packages/model-gateway/src/cognitive-orchestrator.ts`
- Modify: `tests/qwen-primary-cognitive-orchestration-contracts.test.ts`
- Modify: `tests/qwen-primary-cognitive-orchestration-runtime.test.ts`

**Interfaces:**

- Consumes: `routeIrisModel`, `primaryIrisOrchestratorModel`, and `degradedIrisDialogueModel`.
- Produces: deterministic unavailable-model stops, R0-only degraded dialogue, bounded explicit overrides, and compatibility proof.

- [ ] **Step 1: Add failing fallback and reviewer tests**

```ts
it("uses a clearly labeled Qwen 8B degraded interface only for direct R0 dialogue", async () => {
  const harness = cognitiveHarness();
  const result = await harness.runtime.start(
    conversationRequest({ riskClass: "R0", availableModels: ["qwen3:8b"] }),
    policy(["conversation"]),
  );
  expect(result.phase).toBe("degraded-interface");
  expect(result.presentation?.provenance.orchestratorModel).toBe("qwen3:8b");
  expect(result.presentation?.degraded).toBe(true);
});

it("stops delegated work when the primary orchestrator or required reviewer is unavailable", async () => {
  const noPrimary = cognitiveHarness();
  expect((await noPrimary.runtime.start(
    codingRequest({ availableModels: ["qwen3-coder:30b", "gpt-oss:20b"] }),
    codingPolicy(),
  )).phase).toBe("recovery-required");
  const noReviewer = cognitiveHarness();
  expect((await noReviewer.runtime.start(
    codingRequest({ availableModels: ["qwen3.6:27b", "qwen3-coder:30b"] }),
    codingPolicy(),
  )).phase).toBe("reviewer-model-unavailable");
});
```

Also prove that a Founder override changes only the allowlisted route, retains `explicitOverride: true`, retains the same objective/scope/authority, and still requires distinct review for material work.

- [ ] **Step 2: Run the focused tests and confirm fallback failures**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-contracts.test.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts
```

Expected: exit code `1` until the fallback matrix is implemented.

- [ ] **Step 3: Implement the exact fallback matrix**

- Use `qwen3.6:27b` for planning and final synthesis when available.
- Permit `qwen3:8b` only for R0 direct conversation/fast response; set `degraded-interface`, `degraded: true`, and disclose it.
- Never use Qwen 8B as final judgment for coding, research, deep reasoning, protected effects, or reviewed work.
- Stop delegated work with exact missing-model evidence instead of silently weakening purpose.
- Save `reviewer-model-unavailable` when a required reviewer is absent or not distinct.
- Preserve all current `routeIrisModel` tests unchanged.

- [ ] **Step 4: Run all model-gateway compatibility tests**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/model-router.test.ts tests/model-gateway-ollama.test.ts tests/cycle-five-founder-dialogue.test.ts tests/qwen-primary-cognitive-orchestration-contracts.test.ts tests/model-lease-scheduler.test.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts
```

Expected: exit code `0`.

- [ ] **Step 5: Commit the policy slice locally**

```powershell
git add -- packages/model-gateway/src/cognitive-orchestrator.ts tests/qwen-primary-cognitive-orchestration-contracts.test.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts
git commit -m "feat: enforce cognitive model fallback policy"
```

---

### Task 7: Export the Core API and document the implemented contract

**Files:**

- Modify: `packages/model-gateway/src/index.ts:1-6`
- Create: `docs/specifications/qwen-primary-cognitive-orchestration.md`
- Modify: `tests/qwen-primary-cognitive-orchestration-contracts.test.ts`

**Interfaces:**

- Consumes: all completed Core modules.
- Produces: stable package exports and a checked-in implementation specification for the later Command Center binding.

- [ ] **Step 1: Add a failing public-export test**

```ts
import {
  CognitiveOrchestrator,
  CognitiveTurnError,
  ModelLeaseScheduler,
  cognitiveTurnRequestSchema,
  primaryIrisOrchestratorModel,
  routeIrisModel,
} from "../packages/model-gateway/src/index.js";

it("exports the additive cognitive API without removing the existing router", () => {
  expect(primaryIrisOrchestratorModel).toBe("qwen3.6:27b");
  expect(CognitiveOrchestrator).toBeTypeOf("function");
  expect(CognitiveTurnError).toBeTypeOf("function");
  expect(ModelLeaseScheduler).toBeTypeOf("function");
  expect(cognitiveTurnRequestSchema).toBeDefined();
  expect(routeIrisModel).toBeTypeOf("function");
});
```

- [ ] **Step 2: Run the contract test and confirm export failure**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/qwen-primary-cognitive-orchestration-contracts.test.ts
```

Expected: exit code `1` until `index.ts` exports the new modules.

- [ ] **Step 3: Add exact exports**

Append without changing existing exports:

```ts
export * from "./cognitive-orchestrator.js";
export * from "./cognitive-turn-contracts.js";
export * from "./cognitive-turn-errors.js";
export * from "./model-lease-scheduler.js";
```

- [ ] **Step 4: Write the implementation specification**

Record ownership and model roles; schemas; validation order; unchanged specialist routing; distinct review; sequential leases and visible transitions; exact evidence; one synthesis repair; interruption/recovery; R0 fallback; security; authority; compatibility; rollback; non-claims; and the exact-merged-Core binding required for Command Center work. Do not claim live Ollama acceptance, Command Center integration, deployment, or Phase 0 graduation.

- [ ] **Step 5: Run format, type, and focused tests**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec prettier --check packages/model-gateway/src/index.ts docs/specifications/qwen-primary-cognitive-orchestration.md
& 'C:\Program Files\nodejs\corepack.cmd' pnpm typecheck
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/model-router.test.ts tests/model-gateway-ollama.test.ts tests/cycle-five-founder-dialogue.test.ts tests/qwen-primary-cognitive-orchestration-contracts.test.ts tests/model-lease-scheduler.test.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts
```

Expected: all three commands exit `0`.

- [ ] **Step 6: Commit exports and specification locally**

```powershell
git add -- packages/model-gateway/src/index.ts docs/specifications/qwen-primary-cognitive-orchestration.md tests/qwen-primary-cognitive-orchestration-contracts.test.ts
git commit -m "docs: specify Qwen cognitive orchestration"
```

---

### Task 8: Verify, record evidence, and prepare independent-review handoff

**Files:**

- Create: `evidence/model-routing/qwen-primary-cognitive-orchestration-2026-08-08.md`
- Create: `.iris/coordination/handoffs/qwen-primary-cognitive-orchestration-core.json`

**Interfaces:**

- Consumes: the approved task, exact branch/base, complete patch, focused results, and full verification output.
- Produces: truthful evidence and a schema-valid review handoff; it does not approve, push, merge, or publish the producer's work.

- [ ] **Step 1: Run deterministic scope checks**

```powershell
& 'C:\Users\Admin\.codex\skills\iris-dev\iris-dev.cmd' task validate .iris/coordination/tasks/qwen-primary-cognitive-orchestration-core.json --json
& 'C:\Users\Admin\.codex\skills\iris-dev\iris-dev.cmd' scope check --task .iris/coordination/tasks/qwen-primary-cognitive-orchestration-core.json --repo core --root C:/Projects/STOIC-IRIS-qwen-primary-cognitive-orchestration --json
git status --short
git diff --name-only 6367e4547d34092472c672ee93a9e1b2a8e5c80f...HEAD
git diff --check 6367e4547d34092472c672ee93a9e1b2a8e5c80f...HEAD
```

Expected: task validation, scope check, and diff check exit `0`; every changed path is approved.

- [ ] **Step 2: Run the focused Core profile**

```powershell
& 'C:\Users\Admin\.codex\skills\iris-dev\iris-dev.cmd' verify --repo core --root C:/Projects/STOIC-IRIS-qwen-primary-cognitive-orchestration --profile focused --test tests/qwen-primary-cognitive-orchestration-contracts.test.ts --json
& 'C:\Users\Admin\.codex\skills\iris-dev\iris-dev.cmd' verify --repo core --root C:/Projects/STOIC-IRIS-qwen-primary-cognitive-orchestration --profile focused --test tests/model-lease-scheduler.test.ts --json
& 'C:\Users\Admin\.codex\skills\iris-dev\iris-dev.cmd' verify --repo core --root C:/Projects/STOIC-IRIS-qwen-primary-cognitive-orchestration --profile focused --test tests/qwen-primary-cognitive-orchestration-runtime.test.ts --json
```

Expected: all three commands exit `0` without network installation.

- [ ] **Step 3: Run full repository verification**

```powershell
$env:COREPACK_ENABLE_NETWORK = '0'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm verify
```

Expected: exit code `0` for formatting, lint, typecheck, all tests, build, and diagnostics. Record every skip or environment limitation rather than calling it a pass.

- [ ] **Step 4: Write the evidence record**

Record exact base, branch, result commit, changed paths, commands, exit codes, contract/routing/review/evidence/lease/fallback/interruption/compatibility results, unchanged dependency manifests, no live provider effect, pending Command Center/live Ollama limitations, and history-preserving rollback.

Run the same `iris-dev scope check` again after the evidence and handoff files exist and before staging them.

- [ ] **Step 5: Create and validate the handoff**

Use `handoff_id` and `task_id` `qwen-primary-cognitive-orchestration-core`; exact producer/independent recipient; exact base/result/patch digest; exact paths and commands; `ready_for_review: true` only after all checks pass; and protected actions for independent review, repair, non-force push, PR, merge, synchronization, cleanup, and the separate Command Center tranche.

```powershell
@'
const fs = require("node:fs");
const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schema = JSON.parse(fs.readFileSync(".iris/coordination/handoff.schema.json", "utf8"));
const handoff = JSON.parse(fs.readFileSync(".iris/coordination/handoffs/qwen-primary-cognitive-orchestration-core.json", "utf8"));
if (!ajv.validate(schema, handoff)) {
  console.error(ajv.errors);
  process.exit(1);
}
'@ | & 'C:\Program Files\nodejs\node.exe'
```

Expected: exit code `0`.

- [ ] **Step 6: Commit evidence and handoff locally**

```powershell
git add -- evidence/model-routing/qwen-primary-cognitive-orchestration-2026-08-08.md .iris/coordination/handoffs/qwen-primary-cognitive-orchestration-core.json
git commit -m "test: verify Qwen cognitive orchestration"
```

- [ ] **Step 7: Stop for independent review**

Do not push, create a pull request, merge, synchronize, clean the worktree, modify the Command Center, or run live Ollama acceptance unless the active task explicitly authorizes those actions. Present the exact result commit, patch digest, paths, verification, limitations, and rollback.

## Command Center Follow-On Gate

After this Core tranche is independently reviewed, merged, and synchronized:

1. Record the exact merged Core `main` revision.
2. Re-inspect `C:\Projects\iris-founder-command-center-main` from synchronized `main`.
3. Write `docs/superpowers/plans/2026-08-08-qwen-primary-cognitive-orchestration-command-center.md` in a new isolated Command Center worktree.
4. Bind its task to the exact merged Core revision and the then-current Command Center revision.
5. Plan gateway integration, persistent conversation, live transitions, pause/cancel/steering, real Ollama acceptance, VRAM/process evidence, cleanup, and an assertion that no existing capability disappears from the Founder capability tree without redefining any Core schema.

This gate is sequential because a future or feature-branch Core reference would violate the approved ownership boundary and make Command Center integration non-reproducible.
