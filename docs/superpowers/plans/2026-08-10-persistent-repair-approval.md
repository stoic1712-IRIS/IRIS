# Persistent Repository-Repair Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the arbitrary repository-repair approval countdown while preserving exact digest binding, one-time consumption, revision checks, and bounded execution.

**Architecture:** IRIS Core remains authoritative for the proposal contract and approval verification. The Founder Command Center mirrors the strict contract and renders an approval form without local time-based invalidation.

**Tech Stack:** TypeScript, Zod, React, Vitest, Node.js

## Global Constraints

- Remove expiry only from repository-repair proposals; do not weaken other capability or execution deadlines.
- Keep the exact typed statement, eight-digit terminal-code HMAC binding, one-time consumption, replay denial, and revision drift checks.
- Do not add dependencies or modify lockfiles.

---

### Task 1: Core persistent proposal contract

**Files:**
- Modify: `packages/kernel/src/repository-repair.ts`
- Modify: `tests/release-seven-repository-repair.test.ts`

**Interfaces:**
- Consumes: `createRepositoryRepairProposal`, `verifyRepositoryRepairApproval`
- Produces: `RepositoryRepairProposal` without `expiresAt`

- [ ] **Step 1: Write the failing Core test**

Change the approval test to assert that the proposal has no `expiresAt` field and remains valid when `now` is one year after creation.

- [ ] **Step 2: Verify the Core test fails**

Run: `iris-dev verify --repo core --root C:\Projects\STOIC-IRIS-remove-repair-approval-window --profile focused --test tests/release-seven-repository-repair.test.ts --json`

Expected: failure because the current schema includes `expiresAt` and rejects the late approval.

- [ ] **Step 3: Implement the Core contract**

Remove `repositoryRepairApprovalWindowMs`, remove `expiresAt` from `repositoryRepairProposalSchema`, remove it from the proposal constructor omission list and digest input, and remove the wall-clock expiry check from `verifyRepositoryRepairApproval`.

- [ ] **Step 4: Verify the Core test passes**

Run the focused command from Step 2 and require exit code `0`.

### Task 2: Command Center strict transport and timer-free interface

**Files:**
- Modify: `src/repository-repair.ts`
- Modify: `src/views/Repair.tsx`
- Modify: `tests/repository-repair.test.ts`
- Modify: `tests/repair.test.tsx`
- Modify: `scripts/local-gateway.mjs`
- Modify: `tests/local-gateway.test.ts`

**Interfaces:**
- Consumes: Core `RepositoryRepairProposal` JSON
- Produces: strict `RepairProposal` without `expiresAt` and a timer-free Founder form

- [ ] **Step 1: Write failing transport, gateway, and rendering tests**

Assert that proposal parsing rejects an invented `expiresAt`, the gateway does not retire an active repair by elapsed time, and `Repair.tsx` contains no interval/countdown/expiry gate while retaining the failed-run replacement path.

- [ ] **Step 2: Verify the Command Center tests fail**

Run focused tests for `tests/repository-repair.test.ts`, `tests/repair.test.tsx`, and `tests/local-gateway.test.ts`; require failures caused by current expiry behavior.

- [ ] **Step 3: Implement the timer-free mirror and gateway state**

Remove `expiresAt` from the mirror schema, remove the countdown helper and React interval, remove time-expiry button gating and copy, and make gateway active-repair validation depend on one-time lifecycle and exact digest/revision state rather than elapsed time.

- [ ] **Step 4: Verify the Command Center focused tests pass**

Run the three focused tests and require exit code `0`.

### Task 3: Full verification and handoff

**Files:**
- Verify all changed files from Tasks 1 and 2

**Interfaces:**
- Consumes: completed Core and Command Center changes
- Produces: locally verified branches ready for Founder-authorized publication

- [ ] **Step 1: Run full Core verification**

Run: `iris-dev verify --repo core --root C:\Projects\STOIC-IRIS-remove-repair-approval-window --profile full --json`

- [ ] **Step 2: Run full Command Center verification**

Run: `iris-dev verify --repo command-center --root C:\Projects\iris-founder-command-center-remove-repair-approval-window --profile full --json`

- [ ] **Step 3: Inspect exact changed paths**

Run `git status --short` and `git diff --check` in both worktrees. Confirm no lockfile, dependency manifest, credential, provider, or unrelated path changed.

- [ ] **Step 4: Commit locally only after all verification is green**

Create exact-path commits in each repository. Do not push, merge, or restart the canonical runtime without separate Founder authorization.
