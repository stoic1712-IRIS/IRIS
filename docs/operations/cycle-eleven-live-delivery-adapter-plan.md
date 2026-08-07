# Cycle Eleven Live Complete-Delivery Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the canonical complete-software-delivery runtime with a real local provider adapter and Founder control surface that stops before merge.

**Architecture:** IRIS Core remains the state, authorization, and evidence authority. A dependency-injected Command Center module binds validated local Git worktrees, exact commands, local coding/reviewer models, and the existing keyring-backed GitHub CLI; the gateway exposes only authenticated loopback routes.

**Tech Stack:** TypeScript, Node.js ESM, Zod, Git, GitHub CLI, Ollama, React, Vitest.

## Global Constraints

- Preserve every existing Phase 0, wave, release, and cycle capability.
- No merge execution, deployment, spending, public/LAN exposure, administration, destructive work, force-push, history rewrite, raw credential access, or final Phase 0 graduation.
- Exact-path staging and non-force publication only.
- Every new behavior follows red-green-refactor.

---

### Task 1: Canonical task and contract

**Files:**
- Create: `.iris/coordination/tasks/cycle-eleven-c-founder-live-delivery-adapter.json`
- Create: `docs/specifications/cycle-eleven-live-delivery-adapter.md`
- Create: `docs/operations/cycle-eleven-live-delivery-adapter-plan.md`

**Interfaces:**
- Consumes: Core `CompleteSoftwareDeliveryRuntime` at the exact bound revision.
- Produces: exact cross-repository path, authority, acceptance, evidence, and publication contract.

- [ ] Validate the task against `.iris/coordination/task.schema.json`.
- [ ] Review the design for placeholders, contradictions, scope drift, and unbound protected effects.
- [ ] Commit and publish the canonical task before Command Center implementation.

### Task 2: Local adapter red-green cycle

**Files:**
- Create: `scripts/complete-delivery-adapter.mjs`
- Create: `tests/complete-delivery-adapter.test.ts`

**Interfaces:**
- Consumes: `CompleteDeliveryObjective`, injected process runner, injected local-model client, repository allowlist.
- Produces: every `CompleteDeliveryAdapter` method consumed by Core.

- [ ] Write failing tests for preflight, path and command denial, deterministic workspace, model identity separation, bounded mutation, and verification.
- [ ] Run the focused test and confirm failures are caused by the missing adapter.
- [ ] Implement inspection, planning, workspace creation, implementation, verification, review, and repair.
- [ ] Write failing tests for idempotent commit/push/PR reconciliation, CI and review-state handling, remote equality, and cleanup.
- [ ] Implement the minimal provider lifecycle and rerun the focused tests to green.

### Task 3: Gateway composition red-green cycle

**Files:**
- Modify: `scripts/local-gateway.mjs`
- Modify: `tests/local-gateway.test.ts`

**Interfaces:**
- Consumes: active Founder access registry, Core runtime, local adapter, operator request.
- Produces: authenticated start/read/pause/resume/cancel state and truthful live delivery projection.

- [ ] Write failing route tests proving software delivery uses the Core runtime and advertises the adapter only after preflight.
- [ ] Add strict repository, read-path, write-path, and verification-command input schemas.
- [ ] Compose the runtime in the existing operator session and implement cancellation, resumption, revocation, and cleanup.
- [ ] Prove the gateway has no merge endpoint and still fails closed for protected effects.

### Task 4: Founder interface red-green cycle

**Files:**
- Modify: `src/operator-client.ts`
- Modify: `src/views/OperatorSession.tsx`
- Modify: `tests/operator-client.test.ts`
- Modify: `tests/operator-session.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: strict gateway delivery projection.
- Produces: explicit bounded launch form, live lifecycle, evidence, PR and equality state, and merge-statement presentation.

- [ ] Write failing client and component tests for active adapter parsing and bounded delivery input.
- [ ] Expand strict schemas without weakening existing general and research routes.
- [ ] Render repository scope, paths, command arrays, lifecycle, recovery, and exact merge statement.
- [ ] Confirm no merge submission control exists.

### Task 5: Verification and held-out certification

**Files:**
- Test: all exact paths above.

**Interfaces:**
- Consumes: merged Core task and complete Command Center branch.
- Produces: exact verification evidence and a held-out adapter result.

- [ ] Run focused adapter, gateway, client, and component tests.
- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] Run a disposable held-out local repository through the real Git/model/workspace path without protected provider effects.
- [ ] Independently review the exact patch and repair all blocking findings.
- [ ] Stage exact paths, commit, push non-force, create PR, merge after review, synchronize, verify remote equality, and clean disposable workspaces.

