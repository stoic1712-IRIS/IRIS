# Cycle Nine A Phase 0 Graduation Readiness Evidence

**Date:** 2026-08-06 America/Denver

**Producer:** Codex

**Repository:** `stoic1712-IRIS/IRIS`

**Branch:** `iris/cycle-nine-a-phase-0-graduation-readiness`

**Base revision:** `806cdc60668df1f1ed53ff33ac80bb2e4123afb2`

**Command Center bound revision:** `f0a12b26a7271ed8cb2d2f1b08719b90c397628a`

**Implementation patch digest (`packages`, `scripts`, and `tests`):** `sha256:78dd92f8d66208ec2903ea653c3eb1512bfecdc954c11dbff9932507a87d3fe2`

**Whole material-result patch digest (all non-self-referential operator, context, specification, implementation, runtime, and test paths):** `sha256:9dbceb99483c5516e91a803733d51cd4bb185bdc830a03526b085403a96b11cc`

## Scope and permanent boundary

Cycle Nine A provides IRIS-owned fail-closed machinery for the future Phase 0 graduation. It binds the existing Cycle Eight executable-worker proposal to authenticated and durably consumed Founder approvals, prior real-model repository inspection, a verified multi-file candidate, the exact IRIS independent-review worker, checkpoint-first delivery of the candidate commit itself, a separate merge approval, canonical-main equality, first-parent merge rollback evidence, cleanup, paid-resource termination, and provider-authoritative repository/resource inspection.

This work does not perform or claim the final Phase 0 graduation. Permanent Development Independence remains incomplete until deployed IRIS performs the genuine Founder-operated canonical multi-file self-upgrade while Claude and Codex remain audit-only.

## Canonical authority and shared virtues

- `AGENTS.md`, `CLAUDE.md`, and `docs/operations/stoic-iris-project-context.md` now define canonical as a proved, scoped authority state rather than a filename, status label, recent commit, chat statement, model output, or private memory.
- The operator instructions require exact controlling-source and revision citations and distinguish candidate branches from authoritative integrated `main` with provider equality.
- Claude and Codex operator instructions now cite and apply the exact twelve Core Reasoning Principles already canonical for IRIS and governed workers in `docs/governance/worker-reasoning-framework-and-cognitive-identity.md` version 1.0.0; the operator guidance does not invent a replacement framework.
- The Command Center copy will be updated by its assigned producer only after Cycle Nine B is bound to the reviewed and integrated Core revision; Codex did not mutate Claude's active worktree.

## Foundation and repository verification

- All six byte-authoritative DOCX and readable Markdown hashes matched `C:/Projects/STOIC-IRIS-source-library/SOURCE-MANIFEST.md` before the repair.
- The source library remained outside Git and read-only.
- The isolated worktree derives from exact Core `main` revision `806cdc60668df1f1ed53ff33ac80bb2e4123afb2`.
- The Cycle Nine task JSON parses successfully and `git diff --check` passes.
- Existing unrelated user work was not overwritten.

## Independent-review repairs

The first Claude review and two separate read-only Codex audits correctly blocked publication. The repaired contract now addresses their material findings:

- rollback uses `git revert -m 1 <merge-commit>`;
- the reviewer identity is exactly `iris-independent-review-worker` rather than Claude or Codex;
- the nested executable-worker proposal is structurally bound and requires at least two safe paths;
- model evidence binds prior inspection of the exact repository revision and rejects fixture-like identities;
- candidate, review, delivery, merge, and provider evidence record IRIS actors, exact repositories, and observed Claude/Codex non-participation;
- delivery cannot replace the reviewed candidate with another commit;
- initial and merge approvals use authenticated session evidence and separate durable consumption receipts;
- events bind evidence digests in a verifiable hash chain;
- an approval-ledger write that may have succeeded before an exception is reported as `unknown`, never falsely as unconsumed;
- the candidate must differ from and descend from the exact base, bind different base and candidate trees plus a verified diff digest, and the independent reviewer must bind the same tree and diff evidence;
- model-observation evidence must follow the bound inspection and cannot be future-dated;
- failure reporting records the actual attempted stage and inspects provider state after an exception instead of assuming no mutation; and
- cleanup, paid-resource termination, and provider-zero inspection remain in the success and failure evidence chains.

Two final frozen independent reviews passed the exact repaired material result: one for executable-contract safety and one for canonical authority, governance, and evidence integrity.

## Contract coverage

The focused suite contains 31 tests covering the full success chain and fail-closed behavior for approval alteration, expiry, future issue time, authentication mismatch, replay and uncertain post-write ledger failures, repository and provider drift, unchanged or non-descendant candidates, tree and diff inequality, under-bound or protected-path proposals, stale, future, or fixture model evidence, operator participation, incorrect reviewer identity, delivery/checkpoint/pull-request/merge inequality, merge-parent drift, canonical-main inequality, invalid rollback, cleanup failure, future-dated resource or provider evidence, provider residue, provider mutation followed by an exception, unknown provider state, and event/evidence-chain tampering.

## Verification results

Verification used disposable copy `C:/Projects/STOIC-IRIS-cycle-nine-a-verify-20260806-215211` with the pinned lockfile and local pnpm store.

- `pnpm install --offline --frozen-lockfile --ignore-scripts`: passed; 244 packages reused, 0 downloaded, no version or lockfile change.
- Focused Cycle Nine suite: 1 file, 31 tests passed.
- Direct root TypeScript check: passed.
- Prettier and focused ESLint after repair: passed.
- Clean-copy cold-start `pnpm verify`: preserved failure. Lint ran before generated workspace declarations existed and produced unresolved-type errors across unchanged packages.
- Bootstrap `pnpm build`: passed and generated the pinned workspace declarations.
- Exact post-bootstrap `pnpm verify`: passed.
- Full suite: 36 files and 222 tests passed.
- Root and Visual Composer typechecks: passed.
- TypeScript composite and Visual Composer production builds: passed. Vite emitted only the existing non-failing large-chunk advisory.
- Repository diagnostics: passed and reported the expected bounded branch and changed paths.

The cold-start ordering defect is a real repository reproducibility finding: a clean dependency tree currently requires `pnpm build` before the declared `pnpm verify` sequence can type-resolve internal packages. It is not concealed by the successful post-bootstrap run and should be corrected in a separately bounded toolchain task rather than by silently weakening lint.

## Changed paths from the exact base

- `.iris/coordination/handoffs/cycle-nine-a-phase-zero-graduation-readiness.json`
- `.iris/coordination/tasks/cycle-nine-a-phase-zero-graduation-readiness.json`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/operations/stoic-iris-project-context.md`
- `docs/specifications/cycle-nine-phase-zero-graduation-readiness.md`
- `docs/specifications/wave-10-graduation-self-description.md`
- `evidence/cycle-nine/phase-zero-graduation-readiness-2026-08-06.md`
- `packages/development/src/index.ts`
- `packages/development/src/phase-zero-graduation-readiness.ts`
- `packages/development/src/self-description.ts`
- `packages/kernel/src/read-model.ts`
- `scripts/runtime/iris-core-read-service.mjs`
- `tests/cycle-nine-phase-zero-graduation-readiness.test.ts`
- `tests/release-four-core-read-service.test.ts`
- `tests/wave-10-graduation-self-description.test.ts`

## Current state

- The frozen executable-contract and governance/evidence reviews both passed.
- At this evidence freeze, no repair file had been staged or committed yet.
- No branch push, pull request, merge, provider mutation, credential use, deployment, spending, or public/LAN action occurred during this repair.
- Cycle Nine B remains implementation-blocked until its task binds the reviewed and integrated Cycle Nine A Core revision and exact read contract.
