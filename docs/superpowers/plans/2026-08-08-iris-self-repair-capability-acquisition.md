# IRIS Self-Repair and Capability Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let IRIS diagnose, repair, and extend ordinary capabilities through an exact, reversible, approval-bound workflow instead of returning a generic inability message.

**Architecture:** Add a strict capability-gap classifier and acquisition proposal to the existing capability-learning engine. Compose it with the operator runtime and complete-software-delivery pipeline so an interrupted objective can pause, acquire or repair the missing capability in a disposable workspace, verify/register it, and resume from serialized state.

**Tech Stack:** TypeScript, Zod, existing IRIS research/model/operator/development packages, Vitest.

## Global Constraints

- Research uses official or primary sources and preserves citations, version, digest, license, cost, data exposure, permissions, tests, rollback, and removal.
- Installation never follows from technical availability alone; protected effects and any spending remain separately approved.
- Self-repair uses the canonical repository and disposable worktrees; no direct mutation of `main`.

---

### Task 1: Add exact capability-gap classification

**Files:**
- Create: `packages/capabilities/src/capability-gap.ts`
- Modify: `packages/capabilities/src/index.ts`
- Create: `tests/capability-gap.test.ts`

1. Add failing tests for all ten approved classifications and deterministic evidence requirements.
2. Implement `capabilityGapSchema`, `classifyCapabilityGap()`, and `CapabilityGapEvidence`. Reject vague or evidence-free classifications.
3. Run the focused suite and commit with `feat: classify exact capability gaps`.

### Task 2: Build approval-bound acquisition proposals

**Files:**
- Create: `packages/capabilities/src/capability-acquisition.ts`
- Modify: `packages/capabilities/src/index.ts`
- Create: `tests/capability-acquisition.test.ts`

1. Add failing tests for source, version, SHA-256, license, cost, permission scope, data exposure, install commands, verification, rollback, removal, registry update, expiry, and digest-bound approval statement.
2. Implement strict proposal and result schemas plus `prepareCapabilityAcquisition()` and `verifyCapabilityAcquisitionApproval()`.
3. Reject mutable URLs without immutable version/digest evidence, missing removal plans, provider administration, or widened scope.
4. Run focused tests and commit with `feat: prepare governed capability acquisition`.

### Task 3: Compose self-repair with operator delivery

**Files:**
- Create: `packages/development/src/self-repair-runtime.ts`
- Modify: `packages/development/src/index.ts`
- Create: `tests/self-repair-runtime.test.ts`

1. Add failing tests for observe, reproduce, diagnose, source inspection, exact base binding, disposable worktree, implementation, verification, independent review, repair, non-force push, PR/CI/review, exact-head merge, synchronization, restart, smoke, rollback, cleanup, and evidence.
2. Implement `SelfRepairRuntime` as a composition layer over existing operator and delivery adapters; do not duplicate Git/provider logic.
3. Serialize state and event digests so restart/resume cannot widen the objective or skip verification.
4. Add cancellation and protected-effect pause tests.
5. Run focused suites and commit with `feat: orchestrate governed IRIS self-repair`.

### Task 4: Resume the original objective after acquisition

**Files:**
- Modify: `packages/development/src/operator-parity-runtime.ts`
- Modify: `tests/cycle-twelve-operator-parity-runtime.test.ts`
- Modify: `tests/self-repair-runtime.test.ts`

1. Add failing tests for `capability-required`, `acquisition-awaiting-approval`, `acquiring`, `capability-verified`, and resumed objective states.
2. Bind resume to the original objective digest, model policy, capability proposal digest, verification evidence, and registry revision.
3. Ensure unsupported-after-research terminates with the exact missing capability and evidence, never a generic refusal.
4. Run focused tests and commit with `feat: resume objectives after capability acquisition`.

### Task 5: Document and certify self-repair

**Files:**
- Create: `docs/specifications/iris-self-repair-and-capability-acquisition.md`
- Create: `evidence/post-roadmap/iris-self-repair-capability-acquisition-2026-08-08.md`
- Modify: `docs/governance/capability-package-specification.md`

1. Map the implementation to all 19 canonical capability-package sections and state the ordinary/protected split.
2. Record exact tests, model routing, rollback, cleanup, and an explicit statement that machinery is not Phase 0 graduation.
3. Run `pnpm verify` and commit exact paths with `docs: certify governed self-repair`.
