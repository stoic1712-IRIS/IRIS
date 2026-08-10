# Canonical Operating Contract Core Evidence

**Date:** 2026-08-10

**Repository:** `stoic1712-IRIS/IRIS`

**Branch:** `iris/canonical-operating-contract-core-implementation`

**Bound baseline:** `3a96b6588e7e00ea81dea363a4beca06cbc4d2af`

**Contract:** `iris.stoic/operating-contract/v1`

**Version:** `1.0.0`

**Compiled digest:** `sha256:cc1812bff1a668062e3fd1ebf374189a40d7d9e83f33bb6e82f637301e8e5ea9`

## Founder mandate

The Founder authorized exact-path local staging and commits for the four approved design/plan files, followed by inline Core implementation and local verification. Push, merge, retirement deletion, IRIS restart, and protected provider operations were explicitly excluded.

## Local commits

- `ff41649` — add the authored contract, strict compiler, source binding, and deterministic generated artifact;
- `65b8057` — derive live capability evidence;
- `abda8c7` — add the five-outcome controller decision engine;
- `d9eda94` — separate model authority from controller disposition;
- `5431b80` — bind Full Access and acquisition approvals to canonical lifecycle events;
- `f43e9da` — expose the validated contract through `iris-dev` and the agent first-read rule; and
- `078d2e3` — satisfy strict lint without weakening schemas or invariants;
- `caee2f0` — inspect Git-for-Windows worktrees correctly when the CLI runs through WSL; and
- `10d2714` — preserve immediate fail-closed semantics for every other Git failure.

The approved Core planning commit is `3a96b6588e7e00ea81dea363a4beca06cbc4d2af`. The approved Founder Command Center planning commit remains local in its separate repository.

## Implemented behavior

- one manually maintained strict JSON contract and one generated digest-bound artifact;
- deterministic compilation and source-digest verification;
- live ordered capability evidence;
- exactly five controller-owned outcomes;
- compact contract-bound model and worker context;
- explicit `modelAuthority: "none"` independent of controller executability;
- session-bound ordinary Full Access without a short countdown;
- digest/revision-bound capability-acquisition approval lifecycle;
- exact contract inspection for development agents; and
- compatibility preservation with no retirement deletion.

## Verification environment

The repository pins Node.js `24.19.0` and pnpm `11.20.0`. Both exact versions were already installed locally in Windows and WSL. The default Codex `PATH` also contained older bundled binaries, so the final native gate explicitly placed `C:\Program Files\nodejs` and a temporary wrapper for the already-cached pnpm `11.20.0` package first in the verification process `PATH`. This did not install or modify a system package.

Offline dependency relinking used `COREPACK_ENABLE_NETWORK=0` and `CI=true`. The pinned stores reused 244 packages, downloaded zero packages, and did not change dependency versions or the lockfile.

## Verification record

- Expanded operating-contract acceptance command: exit `0`; 13 test files passed, 67 tests passed.
- Native agent CLI regression command: exit `0`; 2 test files passed, 19 tests passed.
- `pnpm verify` with Node.js `24.19.0`, pnpm `11.20.0`, `COREPACK_ENABLE_NETWORK=0`, and `CI=true`: exit `0`.
- Formatting: passed.
- Contract compiler check: passed with digest `sha256:cc1812bff1a668062e3fd1ebf374189a40d7d9e83f33bb6e82f637301e8e5ea9`.
- TypeScript and visual-composer production build: passed. Vite emitted its pre-existing large-chunk advisory; the build still exited zero.
- ESLint: passed with zero warnings.
- Typecheck: passed.
- Full Vitest suite: 65 test files passed; 526 tests passed and 1 test was intentionally skipped.
- Repository diagnostics: passed and reported the expected implementation branch and local documentation/evidence changes.

An earlier WSL full-suite attempt reached the tests after formatting, compilation, build, lint, and typecheck passed, but two unchanged GitHub CLI tests exceeded their short wall-clock timeouts on the Windows-mounted filesystem. Their assertions did not fail. The same two CLI suites then passed 19/19 under the exact native pinned toolchain, and the complete native gate passed.

## Review record

No independent review is claimed in this local implementation tranche. Independent review remains a publication prerequisite under the approved design. Local self-review checks authority widening, capability loss, source drift, digest instability, generic refusal paths, and hidden protected effects.

## Rollback

Revert the nine implementation commits in reverse order with ordinary history-preserving `git revert`, regenerate the compiled artifact from the restored authored contract, and rerun focused tests and `pnpm verify`. Do not hand-edit the generated artifact, force-push, rewrite history, or delete evidence.

## Explicitly not performed

- no push, pull request, merge, or canonical `main` synchronization;
- no retirement-candidate deletion;
- no IRIS or provider restart;
- no credential use, spending, deployment, public/LAN exposure, or provider mutation; and
- no Phase 0 graduation execution, approval, or completion claim.

## Remaining work

The Founder Command Center implementation plan, independent review, publication, synchronization, restart, live launch acceptance, retirement inventory, and any authorized cleanup remain separate gates.
