# Context-Virtualized Repository Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic full-file repository repair with staged, context-virtualized, exact-edit generation that can safely resume compatible disposable candidates.

**Architecture:** Pure Core helpers create bounded line-addressed context packets and locally validate exact edits. The runtime processes one approved file per stage, streams Ollama output with an activity-aware watchdog, journals each completed stage in the disposable candidate, resumes only exact compatible state, and runs the unchanged fixed verification suite over the accumulated diff.

**Tech Stack:** TypeScript, Zod, Node.js ESM, Git worktrees, Ollama loopback API, Vitest, pnpm.

## Global Constraints

- Preserve exact proposal digest, typed approval, one-time code, repository identity, revision, path, candidate-only, verification, cleanup, USD 0, and zero-provider-authority controls.
- Do not modify dependency manifests, lockfiles, governance documents, registries, GitHub settings, credentials, or non-loopback exposure.
- Model output is untrusted data and never becomes a command, path grant, approval, or canonical write.
- Production behavior must be introduced through a failing focused test first.
- No staging, commit, push, pull request, merge, deployment, or proposal execution is authorized by this plan.

---

### Task 1: Exact-edit and context-request contracts

**Files:**
- Modify: `packages/kernel/src/repository-repair.ts`
- Test: `tests/release-seven-repository-repair.test.ts`

**Interfaces:**
- Produces: `createRepositoryRepairStageModelSchema(proposal)`.
- Produces: `validateRepositoryRepairStageCandidate(value, proposal, targetPath, currentFiles)` returning either `{ kind: "context-request", requests }` or `{ kind: "edits", summary, files }`.

- [x] **Step 1: Write failing tests for exact edits**

  Add tests proving one exact `before` occurrence is replaced, while missing, duplicated, stale, no-op, secret-bearing, and non-target edits throw stable denial errors.

- [x] **Step 2: Run the focused test and confirm RED**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: failure because the new exports and schema do not exist.

- [x] **Step 3: Implement the minimal strict stage schema and validator**

  Define structural model fields `summary`, `edits`, and `contextRequests`; retain all semantic limits in local Zod and application validation. Apply edits sequentially only to `targetPath`, require exactly one current match, and return materialized final file content for the existing downstream diff path.

- [x] **Step 4: Run the focused test and confirm GREEN**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: all focused tests pass.

### Task 2: Bounded context packet builder

**Files:**
- Modify: `packages/kernel/src/repository-repair.ts`
- Test: `tests/release-seven-repository-repair.test.ts`

**Interfaces:**
- Produces: `createRepositoryRepairStagePacket({ proposal, targetPath, files, priorRequests, maximumBytes })`.
- Packet slices contain `path`, `startLine`, `endLine`, `digest`, and `content` exactly once.

- [x] **Step 1: Write failing tests for deduplication and large-file slicing**

  Construct a target also present in `contextFiles`, plus a file larger than the packet budget. Assert the target is not duplicated, slices are line-addressed and digest-bound, total serialized bytes stay under budget, and an allowlisted context request adds a matching slice without adding a new path.

- [x] **Step 2: Run the focused test and confirm RED**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: failure because the packet builder does not exist.

- [x] **Step 3: Implement deterministic ranking and slicing**

  Tokenize only the defect statement, paths, and context-request query. Score fixed line windows by token matches and declaration/test anchors. Sort deterministically by score, path, then line. Deduplicate exact slice keys and stop before the byte ceiling.

- [x] **Step 4: Run the focused test and confirm GREEN**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: all focused tests pass.

### Task 3: Activity-aware streamed Ollama stages

**Files:**
- Modify: `scripts/runtime/iris-repository-repair-worker.mjs`
- Test: `tests/release-seven-repository-repair.test.ts`

**Interfaces:**
- Consumes: stage model schema, stage packet builder, and stage candidate validator from Tasks 1-2.
- Produces: one accumulated validated candidate using the existing final result contract.

- [x] **Step 1: Write failing runtime contract tests**

  Assert the worker no longer contains the complete-replacement instruction or the 120-second `remaining` cap. Assert it uses `stream: true`, iterates approved editable paths, parses newline-delimited Ollama envelopes with a bounded accumulated response, and emits bounded progress metadata.

- [x] **Step 2: Run the focused test and confirm RED**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: failure against the current monolithic worker.

- [x] **Step 3: Implement the staged stream loop**

  Create the disposable worktree before model generation. For each target path, build a packet from current candidate contents, request exact edits, retrieve extra context only from valid requests, apply locally validated edits, and advance. Reset the idle watchdog on every response chunk; retain response and candidate byte ceilings and stop a genuinely inactive stream.

- [x] **Step 4: Run the focused test and confirm GREEN**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: all focused tests pass.

### Task 4: Retained journal and compatible resume

**Files:**
- Modify: `packages/kernel/src/repository-repair.ts`
- Modify: `scripts/runtime/iris-repository-repair-worker.mjs`
- Test: `tests/release-seven-repository-repair.test.ts`

**Interfaces:**
- Produces: strict `repositoryRepairJournalSchema`, `createRepositoryRepairScopeDigest(proposal)`, and `validateRepositoryRepairResume(...)`.
- Worker journal remains outside the Git diff and contains digests, never source text, secrets, codes, or binding material.

- [x] **Step 1: Write failing tests for resume and tamper denial**

  Prove an exact compatible proposal resumes after completed stage one. Prove changed repository, base, remote, finding, defect, paths, commands, authority fields, file digest, or unexpected Git path denies resume.

- [x] **Step 2: Run the focused test and confirm RED**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: failure because the journal contract does not exist.

- [x] **Step 3: Implement journal validation and retention cleanup**

  Write the journal atomically after each stage. On startup, validate the complete scope digest, candidate HEAD, changed-path allowlist, canonical before digests, and completed-stage after digests. Retain only retryable incomplete work until the proposal retention bound; remove exact stale or successful candidate state through the validated candidate-parent path.

- [x] **Step 4: Run the focused test and confirm GREEN**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: all focused tests pass.

### Task 5: Durable capability specification and verification

**Files:**
- Create: `docs/specifications/context-virtualized-repository-repair.md`
- Modify: `.iris/coordination/tasks/context-virtualized-repository-repair-worker.json`

**Interfaces:**
- Documents the permanent IRIS-owned contract and evidence without declaring publication or Phase 0 graduation.

- [x] **Step 1: Write the capability specification**

  Record ownership, packet and edit contracts, stage lifecycle, resume binding, progress evidence, failure codes, security boundaries, verification, rollback, cleanup, limitations, and future provider replacement.

- [x] **Step 2: Validate the coordination task**

  Run: `iris-dev task validate .iris/coordination/tasks/context-virtualized-repository-repair-worker.json --json`

  Expected: `ok: true`.

- [x] **Step 3: Run focused verification**

  Run: `pnpm exec vitest run tests/release-seven-repository-repair.test.ts`

  Expected: all tests pass with zero failures.

- [x] **Step 4: Run full verification**

  Run: `pnpm verify`

  Expected: formatting, lint, typecheck, tests, build, and diagnostics all exit 0. Any skip or environment limitation is reported rather than counted as a pass.

- [x] **Step 5: Inspect scope and rollback**

  Run exact changed-path inspection and confirm every path is in the coordination task. Rollback before publication is removal of the isolated worktree and branch after preserving required evidence; after any future merge it is a normal history-preserving revert.
