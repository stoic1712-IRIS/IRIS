# Canonical Operating Contract Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single versioned IRIS operating contract, deterministic compiler, live capability snapshot, and decision engine that all Core reasoning and execution paths consume.

**Architecture:** `config/iris-operating-contract.v1.json` is the only authored operating-rule artifact. Core strictly validates and compiles it to a digest-bound generated artifact, then combines it with verified live capability/provider/access evidence to produce exactly one operating decision. Models remain untrusted planners with no authority; the IRIS controller owns grants, execution, evidence, and completion.

**Tech Stack:** Node.js 24.19, TypeScript 6.0, Zod 4.4, Vitest 4.1, pnpm 11.20, existing `@stoic-iris/contracts`, `@stoic-iris/capabilities`, `@stoic-iris/kernel`, and `@stoic-iris/model-gateway` packages.

## Global Constraints

- Bound Core baseline: `f4ae5c9352bf99b070261ebefa784a1b0aa8fdde` or a verified reviewed descendant with no conflicting operating-contract work.
- Preserve every existing capability, worker, model, provider, approval, audit, evidence, rollback, and Phase 0 artifact.
- `config/iris-operating-contract.v1.json` is the only manually maintained operating contract.
- Model output retains `modelAuthority: "none"`; controller execution authority is represented separately.
- Every actionable objective resolves to `execute-now`, `acquire-capability`, `request-protected-approval`, `repair-runtime`, or `report-terminal`.
- Full Access includes registered ordinary capabilities only and never silently includes a protected effect.
- Founder approvals remain valid until consumed, replaced, revoked, or invalidated by canonical revision/contract drift; do not add short countdown expiry.
- Do not add dependencies, models, credentials, paid services, deployment, public exposure, LAN exposure, or provider resources.
- Do not remove compatibility paths in this Core tranche.
- Do not claim Phase 0 graduation.
- Use exact-path staging only. Never use `git add .`, `git add -A`, force-push, destructive reset, or history rewriting.

## File Map

**Create**

- `config/iris-operating-contract.v1.json` — sole authored operating contract.
- `packages/contracts/src/operating-contract.ts` — strict schemas, types, canonical serializer, digest verifier, and compiled loader.
- `scripts/contracts/compile-operating-contract.mjs` — deterministic JSON compiler.
- `generated/iris-operating-contract.compiled.json` — checked-in generated contract and digest.
- `packages/capabilities/src/live-capability-snapshot.ts` — strict live capability/provider/access evidence snapshot.
- `packages/kernel/src/operating-decision-engine.ts` — deterministic five-outcome decision engine.
- `packages/kernel/src/operating-context.ts` — minimum relevant context slice for models and workers.
- `tests/operating-contract.test.ts` — schema, digest, source, uniqueness, and generated-artifact tests.
- `tests/operating-decision-engine.test.ts` — all decision outcomes and no-generic-refusal tests.
- `tests/operating-context.test.ts` — minimal context and authority-separation tests.
- `tests/iris-dev-contract.test.ts` — deterministic agent-facing contract inspection tests.
- `docs/specifications/canonical-operating-contract.md` — generated-contract behavior and operational interpretation.
- `evidence/operating-contract/canonical-operating-contract-core-2026-08-10.md` — commands, exits, changed paths, digest, limitations, and rollback.

**Modify**

- `packages/contracts/src/index.ts` — export operating-contract types.
- `packages/capabilities/src/index.ts` — export live capability snapshot.
- `packages/kernel/src/index.ts` — export decision engine and operating context.
- `packages/model-gateway/src/founder-dialogue.ts` — replace global no-authority wording with explicit model/controller separation and decision input.
- `packages/model-gateway/src/contracts.ts` — rename provider field to `modelAuthority` and attach controller decision without granting the provider authority.
- `packages/model-gateway/src/ollama-adapter.ts` — parse the migrated provider contract.
- `tests/cycle-five-founder-dialogue.test.ts` — migrate exact contract expectations.
- `tests/model-gateway-ollama.test.ts` — prove provider/controller separation.
- `package.json` — add `contract:compile` and include it in verification.
- `scripts/dev/iris-dev.mjs` — expose `contract inspect --json` from the canonical compiled artifact.
- `AGENTS.md` — point agents to the compiled operating contract without duplicating its rules.

## Execution Preconditions

1. Verify both configured canonical repositories are clean and equal to `origin/main` with `iris-dev doctor --json` and `iris-dev repo status --repo both --json`.
2. Create an approved Core coordination task that binds the exact base, branch, allowed paths above, verification commands, independent reviewer, and publication actions.
3. Validate the task with `iris-dev task validate`.
4. Create one isolated worktree with `superpowers:using-git-worktrees` or `iris-dev worktree prepare`.
5. Confirm no dependency materialization is required.

---

### Task 1: Define and compile the canonical contract

**Files:**

- Create: `config/iris-operating-contract.v1.json`
- Create: `packages/contracts/src/operating-contract.ts`
- Create: `scripts/contracts/compile-operating-contract.mjs`
- Create: `generated/iris-operating-contract.compiled.json`
- Create: `tests/operating-contract.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `digest` from `@stoic-iris/contracts` primitives and the existing ordinary/protected capability names.
- Produces: `irisOperatingContractSchema`, `compiledIrisOperatingContractSchema`, `IrisOperatingContract`, `CompiledIrisOperatingContract`, `canonicalizeOperatingContract`, `compileOperatingContract`, and `loadCompiledOperatingContract`.

- [ ] **Step 1: Write failing contract tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  compileOperatingContract,
  irisOperatingContractSchema,
} from "../packages/contracts/src/operating-contract.js";

const source = JSON.parse(
  readFileSync("config/iris-operating-contract.v1.json", "utf8"),
) as unknown;

describe("canonical operating contract", () => {
  it("is strict, deterministic, and complete", () => {
    const contract = irisOperatingContractSchema.parse(source);
    const first = compileOperatingContract(contract);
    const second = compileOperatingContract(
      JSON.parse(JSON.stringify(contract)) as unknown,
    );
    expect(first).toEqual(second);
    expect(new Set(contract.ordinaryCapabilities).size).toBe(
      contract.ordinaryCapabilities.length,
    );
    expect(new Set(contract.protectedEffects).size).toBe(
      contract.protectedEffects.length,
    );
    expect(
      contract.ordinaryCapabilities.filter((value) =>
        contract.protectedEffects.includes(value as never),
      ),
    ).toEqual([]);
  });

  it("rejects extra fields and unknown decision outcomes", () => {
    expect(() => irisOperatingContractSchema.parse({ ...source, extra: true })).toThrow();
    expect(() =>
      irisOperatingContractSchema.parse({
        ...(source as Record<string, unknown>),
        decisionOutcomes: ["execute-now", "ignore-policy"],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because the module and contract do not exist**

```powershell
$env:COREPACK_ENABLE_NETWORK = '0'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-contract.test.ts
```

Expected: exit code `1` with a missing module or missing contract file.

- [ ] **Step 3: Implement the strict contract surface**

Use these exact discriminants and ownership fields:

```ts
export const operatingDecisionKindSchema = z.enum([
  "execute-now",
  "acquire-capability",
  "request-protected-approval",
  "repair-runtime",
  "report-terminal",
]);

export const operatingActorOwnershipSchema = z.object({
  identity: z.literal("iris-core"),
  policy: z.literal("iris-core"),
  authority: z.literal("iris-core"),
  approval: z.literal("founder"),
  execution: z.literal("iris-controller"),
  modelAuthority: z.literal("none"),
  evidence: z.literal("iris-core"),
  presentation: z.literal("iris"),
}).strict();

export const irisOperatingContractSchema = z.object({
  contract: z.literal("iris.stoic/operating-contract/v1"),
  version: z.literal("1.0.0"),
  authorityOrder: z.tuple([
    z.literal("explicit-founder-instruction"),
    z.literal("canonical-operating-contract"),
    z.literal("contract-bound-canonical-sources"),
    z.literal("verified-live-state"),
    z.literal("supporting-context"),
  ]),
  ownership: operatingActorOwnershipSchema,
  ordinaryCapabilities: z.array(z.string().regex(/^[a-z][a-z0-9.-]+$/u)).min(1),
  protectedEffects: z.array(z.string().regex(/^[a-z][a-z0-9.-]+$/u)).min(1),
  decisionOutcomes: z.tuple([
    z.literal("execute-now"),
    z.literal("acquire-capability"),
    z.literal("request-protected-approval"),
    z.literal("repair-runtime"),
    z.literal("report-terminal"),
  ]),
  founderAccess: z.object({
    lifecycle: z.literal("session-bound"),
    invalidatedBy: z.tuple([
      z.literal("logout"),
      z.literal("revocation"),
      z.literal("emergency-stop"),
      z.literal("session-invalidation"),
      z.literal("gateway-replacement"),
    ]),
  }).strict(),
  sources: z.array(z.object({
    path: z.string().min(1).max(500),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    role: z.enum(["origin", "governance", "architecture", "registry", "specification"]),
  }).strict()).min(1),
  legacyAliases: z.record(z.string(), z.string()),
}).strict();
```

Implement canonical serialization by recursively sorting object keys while preserving array order. Compute `contractDigest` from the canonical JSON bytes. Reject a compiled artifact when recalculation differs.

- [ ] **Step 4: Author the v1 contract and compiler**

Populate `ordinaryCapabilities` from `founder-access-profile.ts`, `protectedEffects` from `protectedCapabilitySchema`, and exact source digests from the canonical files. The compiler must read only the exact input/output paths, write UTF-8 with a trailing newline, and produce no timestamps.

- [ ] **Step 5: Generate and verify the artifact**

```powershell
node scripts/contracts/compile-operating-contract.mjs
git diff --exit-code -- generated/iris-operating-contract.compiled.json
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-contract.test.ts
```

Expected: compiler exit `0`, the second compile creates no diff, focused test passes.

- [ ] **Step 6: Add verification script and exact exports**

Add `"contract:compile": "node scripts/contracts/compile-operating-contract.mjs --check"` and place it before build in `verify`. Export from `packages/contracts/src/index.ts` with:

```ts
export * from "./operating-contract.js";
```

- [ ] **Step 7: Run Task 1 verification**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm contract:compile
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-contract.test.ts
& 'C:\Program Files\nodejs\corepack.cmd' pnpm typecheck
```

Expected: all exit `0`.

- [ ] **Step 8: Commit Task 1 exact paths**

```powershell
git add -- config/iris-operating-contract.v1.json packages/contracts/src/operating-contract.ts packages/contracts/src/index.ts scripts/contracts/compile-operating-contract.mjs generated/iris-operating-contract.compiled.json tests/operating-contract.test.ts package.json
git diff --cached --check
git commit -m "feat: add canonical IRIS operating contract"
```

---

### Task 2: Build the live capability snapshot

**Files:**

- Create: `packages/capabilities/src/live-capability-snapshot.ts`
- Create: `tests/live-capability-snapshot.test.ts`
- Modify: `packages/capabilities/src/index.ts`

**Interfaces:**

- Consumes: compiled contract ordinary/protected identifiers, registered providers, active Founder access grant, credential-reference presence, network and workstation evidence.
- Produces: `liveCapabilityEvidenceSchema`, `liveCapabilitySnapshotSchema`, `buildLiveCapabilitySnapshot`, and `LiveCapabilitySnapshot`.

- [ ] **Step 1: Write failing snapshot tests**

```ts
it("represents each contract capability exactly once and never promotes a protected effect", () => {
  const snapshot = buildLiveCapabilitySnapshot({
    contract,
    providers: providerEvidence,
    activeGrant: fullAccessGrant,
    capturedAt: "2026-08-10T18:00:00.000Z",
  });
  expect(snapshot.capabilities.map((entry) => entry.capability)).toEqual(
    contract.ordinaryCapabilities,
  );
  expect(snapshot.protectedEffects).toEqual(contract.protectedEffects);
  expect(snapshot.capabilities.every((entry) => entry.protected === false)).toBe(true);
});
```

- [ ] **Step 2: Run and confirm missing-module failure**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/live-capability-snapshot.test.ts
```

- [ ] **Step 3: Implement snapshot evidence**

Each capability entry must include `registered`, `providerInstalled`, `providerRunning`, `providerCompatible`, `authorized`, `credentialReferenceAvailable`, `sourceReachable`, `hardwareSufficient`, `supportedAfterResearch`, `protected`, `evidence`, and `capturedAt`. Build entries in contract order and reject duplicate/missing provider evidence.

- [ ] **Step 4: Add status derivation**

Use only these statuses:

```ts
export const liveCapabilityStatusSchema = z.enum([
  "ready",
  "needs-access",
  "needs-provider-repair",
  "needs-acquisition",
  "protected",
  "unsupported",
]);
```

Do not store UI labels such as `learning` or `restricted` in Core.

- [ ] **Step 5: Run focused verification and commit**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/live-capability-snapshot.test.ts tests/capability-gap-and-acquisition.test.ts
git add -- packages/capabilities/src/live-capability-snapshot.ts packages/capabilities/src/index.ts tests/live-capability-snapshot.test.ts
git diff --cached --check
git commit -m "feat: derive live capability evidence"
```

---

### Task 3: Implement the five-outcome decision engine

**Files:**

- Create: `packages/kernel/src/operating-decision-engine.ts`
- Create: `tests/operating-decision-engine.test.ts`
- Modify: `packages/kernel/src/index.ts`

**Interfaces:**

- Consumes: `OperatingObjective`, `CompiledIrisOperatingContract`, `LiveCapabilitySnapshot`, active grant reference, and completion evidence.
- Produces: `operatingDecisionSchema`, `OperatingDecision`, and `decideOperatingAction`.

- [ ] **Step 1: Write one failing test for each outcome**

Tests must cover: ready + authorized -> `execute-now`; absent provider -> `acquire-capability`; stopped provider -> `repair-runtime`; protected effect -> `request-protected-approval`; completed objective -> `report-terminal`. Add a table test proving no actionable case has a reply containing `cannot`, `not connected`, `no authority`, or `run these commands yourself`.

- [ ] **Step 2: Run and confirm missing-module failure**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-decision-engine.test.ts
```

- [ ] **Step 3: Implement the discriminated decision schema**

```ts
export const operatingDecisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("execute-now"), objectiveId, capabilities, grantId, nextAction }).strict(),
  z.object({ kind: z.literal("acquire-capability"), objectiveId, gap, acquisitionRequired: z.literal(true) }).strict(),
  z.object({ kind: z.literal("request-protected-approval"), objectiveId, effect, proposalRequired: z.literal(true) }).strict(),
  z.object({ kind: z.literal("repair-runtime"), objectiveId, capability, gap, repairRequired: z.literal(true) }).strict(),
  z.object({ kind: z.literal("report-terminal"), objectiveId, terminalState, evidence }).strict(),
]);
```

`decideOperatingAction` evaluates terminal state first, protected effects second, then every required ordinary capability using `classifyCapabilityGap`. It returns the first unsatisfied condition in contract capability order. It never fabricates provider evidence.

- [ ] **Step 4: Run focused tests and commit**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-decision-engine.test.ts tests/live-capability-snapshot.test.ts tests/capability-gap-and-acquisition.test.ts
git add -- packages/kernel/src/operating-decision-engine.ts packages/kernel/src/index.ts tests/operating-decision-engine.test.ts
git diff --cached --check
git commit -m "feat: unify IRIS operating decisions"
```

---

### Task 4: Assemble minimum relevant operating context

**Files:**

- Create: `packages/kernel/src/operating-context.ts`
- Create: `tests/operating-context.test.ts`
- Modify: `packages/kernel/src/index.ts`
- Modify: `packages/model-gateway/src/founder-dialogue.ts`
- Modify: `packages/model-gateway/src/contracts.ts`
- Modify: `packages/model-gateway/src/ollama-adapter.ts`
- Modify: `tests/cycle-five-founder-dialogue.test.ts`
- Modify: `tests/model-gateway-ollama.test.ts`

**Interfaces:**

- Consumes: contract, objective, decision, exact evidence references, and only the applicable live capability entries.
- Produces: `operatingContextSliceSchema`, `assembleOperatingContext`, provider response `modelAuthority`, and controller `decision`.

- [ ] **Step 1: Write failing context and dialogue tests**

Assert that the context contains the five outcomes, the exact active decision, and only requested capabilities. Assert that model output has `modelAuthority: "none"`, while controller decision can be `execute-now`. Assert the system prompt does not contain `You have no execution authority` and instead contains `You do not own authority; the IRIS controller may execute the supplied validated decision.`

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-context.test.ts tests/cycle-five-founder-dialogue.test.ts tests/model-gateway-ollama.test.ts
```

- [ ] **Step 3: Implement the context slice**

```ts
export const operatingContextSliceSchema = z.object({
  contract: z.object({ version: z.string(), digest: digestSchema }).strict(),
  identity: z.literal("IRIS"),
  founderRelationship: z.literal("Founder-operated"),
  objective: operatingObjectiveSchema,
  decision: operatingDecisionSchema,
  applicableCapabilities: z.array(liveCapabilityEvidenceSchema).max(32),
  protectedEffects: z.array(z.string()).max(16),
  exactEvidence: z.array(evidenceReferenceSchema).max(100),
  modelAuthority: z.literal("none"),
}).strict();
```

- [ ] **Step 4: Migrate provider response semantics**

Replace provider response `authority` with `modelAuthority`. Add a strict controller projection:

```ts
controller: z.object({
  decision: operatingDecisionKindSchema,
  executable: z.boolean(),
  activeGrantId: z.string().nullable(),
}).strict()
```

No model may set `controller`; Core attaches it after parsing provider output.

- [ ] **Step 5: Run focused tests and commit**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-context.test.ts tests/cycle-five-founder-dialogue.test.ts tests/model-gateway-ollama.test.ts tests/qwen-primary-cognitive-orchestration-contracts.test.ts tests/qwen-primary-cognitive-orchestration-runtime.test.ts
git add -- packages/kernel/src/operating-context.ts packages/kernel/src/index.ts packages/model-gateway/src/founder-dialogue.ts packages/model-gateway/src/contracts.ts packages/model-gateway/src/ollama-adapter.ts tests/operating-context.test.ts tests/cycle-five-founder-dialogue.test.ts tests/model-gateway-ollama.test.ts
git diff --cached --check
git commit -m "fix: separate model and controller authority"
```

---

### Task 5: Expose the same contract to Codex and development agents

**Files:**

- Create: `tests/iris-dev-contract.test.ts`
- Modify: `scripts/dev/iris-dev.mjs`
- Modify: `AGENTS.md`

**Interfaces:**

- Consumes: `loadCompiledOperatingContract`, canonical repository status, optional `--capability` values.
- Produces: `iris-dev contract inspect [--capability NAME] --json`.

- [ ] **Step 1: Write failing CLI tests**

Test the exact JSON shape, deterministic digest, canonical Core revision, one requested capability slice, unknown capability refusal, and nonzero exit when the compiled contract is missing or invalid.

- [ ] **Step 2: Run and confirm the command is absent**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/iris-dev-contract.test.ts
```

- [ ] **Step 3: Implement the command**

The JSON response is validated by this exact local schema before printing:

```ts
const contractInspectionSchema = z.object({
  ok: z.literal(true),
  contract: z.literal("iris.stoic/operating-contract/v1"),
  version: z.literal("1.0.0"),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  authorityOrder: irisOperatingContractSchema.shape.authorityOrder,
  coreRevision: z.string().regex(/^[a-f0-9]{40}$/u),
  capability: z.string().nullable(),
}).strict();
```

`--capability` returns the exact requested contract capability name or exits nonzero for an unknown name. The command never reports that an agent has authority or approval.

- [ ] **Step 4: Add the first-read rule**

Add this exact rule to `AGENTS.md` without duplicating contract contents:

```markdown
## Canonical operating contract

Before reasoning about capability, authority, execution, repair, acquisition, or completion, run `node scripts/dev/iris-dev.mjs contract inspect --json` and validate `generated/iris-operating-contract.compiled.json`. Its digest-bound v1 contract is the single runtime decision source. Canonical source documents remain provenance and detail sources; do not reconstruct a competing policy from summaries or prior conversation.
```

- [ ] **Step 5: Run focused tests and commit**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/iris-dev-contract.test.ts tests/operating-contract.test.ts
git add -- scripts/dev/iris-dev.mjs tests/iris-dev-contract.test.ts AGENTS.md
git diff --cached --check
git commit -m "feat: expose operating contract to agents"
```

---

### Task 6: Record specification, diagnostics, and full evidence

**Files:**

- Create: `docs/specifications/canonical-operating-contract.md`
- Create: `evidence/operating-contract/canonical-operating-contract-core-2026-08-10.md`
- Preserve: `docs/superpowers/specs/2026-08-10-canonical-operating-contract-consolidation-design.md`
- Preserve: `docs/superpowers/plans/2026-08-10-canonical-operating-contract-core.md`

**Interfaces:**

- Consumes: final compiled digest, changed-path list, verification output, reviewer findings.
- Produces: first-read pointer and auditable Core handoff.

- [ ] **Step 1: Write the canonical behavior specification**

Document the authored/compiled paths, five outcomes, actor ownership, Full-access lifecycle, capability-acquisition behavior, source-binding rules, startup failures, and rollback. Include the exact contract digest generated by Task 1.

- [ ] **Step 2: Run full verification**

```powershell
$env:COREPACK_ENABLE_NETWORK = '0'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm verify
git status --short
git diff --check
```

Expected: verify exit `0`; only exact planned paths changed.

- [ ] **Step 3: Request independent review**

Reviewer must compare the exact branch diff to the design and report Critical/Important findings for authority widening, capability loss, source drift, digest instability, generic refusal paths, or hidden protected effects. Repair and rerun full verification for every accepted finding.

- [ ] **Step 4: Write evidence and commit exact paths**

Record all commands, exit codes, contract digest, changed paths, review result, limitations, and rollback commands. Then:

```powershell
git add -- docs/specifications/canonical-operating-contract.md evidence/operating-contract/canonical-operating-contract-core-2026-08-10.md docs/superpowers/specs/2026-08-10-canonical-operating-contract-consolidation-design.md docs/superpowers/plans/2026-08-10-canonical-operating-contract-core.md
git diff --cached --check
git commit -m "docs: bind canonical operating contract"
```

- [ ] **Step 5: Stop at the protected publication gate**

Report exact commits, verification, review, contract digest, staged/unstaged state, and the exact non-force push/PR authority required. Do not push or merge without the active Founder mandate and repository task authorizing those actions.
