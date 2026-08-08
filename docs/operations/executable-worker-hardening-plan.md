# Deterministic Executable-Worker Hardening Implementation Plan

**Status:** Approved for local implementation and verification; publication excluded

## Bound revisions

- IRIS Core: `8d29c18d3e89bdc81797b1a28b7e623d905d1423`
- Founder Command Center activation branch: `57af9e2a2076c0e90a53e43c0a2f173a945e84db`

## Task 1: Lock the Core contracts with failing tests

Modify `tests/cycle-eight-executable-worker-runtime.test.ts` first. Add regression tests proving:

- an update cannot rewrite the whole file;
- stale digests, duplicate matches, overlaps, NUL content, and credential-like results fail closed;
- baseline, normalization, and all verification results are durable;
- a reload supplies the prior failed checks to repair;
- sensitive output is redacted while the raw digest and byte count survive;
- cleanup verifies both Git registration and physical absence, remains recoverable after partial failure, and is retryable;
- cleanup rejects a workspace outside the configured root;
- atomic-write failure preserves original content; and
- candidate checkpointing is impossible with incomplete evidence or failed commands.

Run the focused test and record the intended failures before production changes.

## Task 2: Implement the deterministic Core contract

Update:

- `packages/development/src/executable-worker-contracts.ts`
- `packages/development/src/execution-journal.ts`
- `packages/development/src/executable-worker-runtime.ts`
- `packages/development/src/git-candidate-workspace-adapter.ts`

Implement proposal-bound baseline and normalization commands, digest-bound exact replacements, atomic writes, journal version 3 approval-binding and attempt evidence, redacted command persistence, restart-safe previous checks, structured cleanup evidence, root containment, bounded cleanup retries, and truthful lifecycle states.

Update `scripts/development/cycle-eight-live-proof.mjs` only for compile-time contract compatibility; do not run a live proof without a new exact Founder approval.

Run the focused Core test until it passes.

## Task 3: Lock the Command Center contract with failing tests

Modify `tests/local-gateway.test.ts` first. Add regression tests proving:

- proposals bind baseline and normalization commands before approval;
- the model prompt requests exact replacements and file digests, never complete updated files;
- gateway restart reconstructs command and cleanup evidence from the Core journal;
- cleanup failure remains visibly recovery-ready; and
- old or incomplete journal evidence is never presented as complete.

Run the focused test and record the intended failures before production changes.

## Task 4: Implement Command Center integration

Update:

- `scripts/local-gateway.mjs`
- `src/executable-worker-client.ts`
- `src/views/Develop.tsx` only if the existing UI cannot represent the structured cleanup or command evidence truthfully.

Keep the loopback, authentication, CSRF, approval, and authority boundaries unchanged. Use the Core-owned contracts; do not duplicate policy in the interface.

Run the focused Command Center test until it passes.

## Task 5: Reconcile documentation and broad verification

Update `docs/specifications/cycle-eight-executable-worker-runtime.md` so the canonical candidate text no longer claims complete-file updates or boolean-only cleanup.

Run:

1. Core focused test.
2. Core `pnpm verify`.
3. Command Center focused test.
4. Command Center `pnpm verify`.
5. `git diff --check` and exact changed-path review in both worktrees.
6. Prove `package.json` and `pnpm-lock.yaml` remain byte-identical to each worktree base.

Do not stage, commit, push, create a pull request, merge, deploy, or run a new live executable-worker proposal. Retain the isolated worktrees for Founder review.
