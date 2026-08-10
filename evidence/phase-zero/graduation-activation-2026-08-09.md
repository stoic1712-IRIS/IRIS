# Phase 0 Graduation Activation Evidence — 2026-08-09

## Mandate

The Founder authorized implementation, local verification, non-force publication, review, merge, synchronization, restart, and proposal-only smoke testing of the missing IRIS-owned Phase 0 proposal and activation path. The mandate explicitly excludes Codex or Claude approval or execution of the resulting graduation proposal.

## Bound bases

- IRIS Core `main`: `ff82266d5f1702f96bff015f44a185cd3c8dac9b`
- Founder Command Center `main`: `7dfbed6e4a71c615971e6ae1cd2118d6ae616800`
- Core branch: `iris/phase-zero-graduation-activation`
- Command Center branch: `iris/phase-zero-graduation-activation`

## Implemented controls

- Core-owned strict proposal creation route with distinct signed proposal scope.
- Exact canonical Core and Command Center evidence with clean-main and remote-equality checks.
- Real loopback `qwen3-coder:30b` proposal model behind a strict schema and bounded evidence.
- Protected-path and verification-command allowlists before durable proposal creation.
- Atomic outside-Git Core proposal and one-time approval ledger.
- Exact authenticated Founder approval consumption and exactly-once activation of the existing graduation runtime.
- Real disposable worker, independent local reviewer model, checkpoint-first delivery, merge rendezvous, remote equality, rollback, cleanup, termination, and zero-resource provider adapters.
- Command Center presentation and authenticated relay only; no local graduation authority.

## Verification

- Core focused: 2 files, 15 tests passed.
- Core full: formatting, build, lint, typecheck, 60 test files, 486 tests passed, 1 existing skip, diagnostics; exit 0; report digest `sha256:18c71d943809444e7a60383ef4b2475814200522c694782262966f391aa8b9dd`.
- Command Center focused: 3 files, 95 tests passed, 1 existing skip.
- Command Center full: formatting, lint, typecheck, build, 45 test files, 273 tests passed, 4 existing skips; exit 0; report digest `sha256:4383d5f59f68246031254b610e55021e43af8cc33d6db7cb52792bb155fb757b`.
- Lockfiles and dependency versions unchanged. Existing pinned dependencies were reused through local worktree junctions.

## Non-claims

- No Phase 0 graduation proposal has been approved or executed.
- Phase 0 is not complete from this implementation.
- No credential was read into model context or persisted by IRIS.
- No force-push, history rewrite, deployment, public or LAN exposure, spending, provider administration, or destructive data operation occurred.
- The historical Wave 10 checkpoint remains evidence of machinery, not permanent Phase 0 completion.

## Remaining actions

Independent exact-patch review, publication and merge, local-main synchronization, runtime restart, and a live real-model proposal-only smoke test remain before this implementation task is complete. The final IRIS-generated approval statement must be presented to the Founder and left unsubmitted.
