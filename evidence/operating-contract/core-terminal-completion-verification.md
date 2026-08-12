# Evidence: Core Terminal Completion Verification

**Task:** `.iris/coordination/tasks/core-terminal-completion-verification.json`

**Producer:** Claude (cloud session on branch `claude/remote-control-v1owqp`)

**Date:** 2026-08-12

**Base:** `stoic1712-IRIS/IRIS` `main` @ `08f69f82846e40d1a428f4238da5f14918965fa1`

## Producer and reviewer

Claude authored the diagnosis, the task record, and this implementation. The Founder was advised that a different producer would preserve an independent technical view on this repair and directed Claude to proceed. The Founder remains the independent reviewer; the producer does not certify this output.

## Terminal emission survey

Every `report-terminal` occurrence in `packages/`:

| Path | Line | Classification |
| --- | --- | --- |
| `packages/kernel/src/operating-decision-engine.ts` | 66 (pre-repair) | caller-asserted, unverified |
| `packages/kernel/src/operating-decision-engine.ts` | 105 | Core-derived from capability snapshot gap evidence |
| `packages/contracts/src/operating-contract.ts` | 14, 79, 190 | outcome declaration and decision schema; originates nothing |
| `packages/kernel/src/operating-context.ts` | 37 | contract outcome tuple validation; originates nothing |
| `packages/model-gateway/src/founder-dialogue.ts` | 105 | explanatory prose in a string |

Two emission sites exist. One was unverified and is now closed; the other is Core-derived and is preserved.

A search for verification of terminal claims (`terminal` intersected with verify, prove, attest, check across the kernel) returned only `terminal.run-approved` in `founder-access-profile.ts`, an unrelated capability name. Nothing verified a terminal claim before this change.

## Change

`completed` is removed from `assertableTerminalStateSchema`, the enum a caller may express, leaving `failed`, `cancelled`, `unsupported`, and `physically-impossible`. `decideOperatingAction` rejects an asserted completion before parsing with `OPERATING_OBJECTIVE_TERMINAL_COMPLETION_NOT_ASSERTABLE`; the narrowed schema is the backstop. The Core-derived `unsupported` path at line 105 is untouched.

## Regression proof

The two new tests were run against the pre-repair engine by restoring `packages/kernel/src/operating-decision-engine.ts` from `main` while keeping the new tests:

```
× refuses a caller-asserted completion instead of reporting it
× refuses an asserted completion even when every requirement is unaddressed
Test Files  1 failed (1)
     Tests  2 failed | 9 passed (11)
```

Both pass after the repair. The engine file was restored byte-identically afterward, confirmed by matching SHA-256 `2b137adba7abacbbd48166374251c9a13ea6f593f612fdc27a0dead63f5ffc77` against the copy taken before the swap.

## Verification results

| Command | Result |
| --- | --- |
| `pnpm exec vitest run tests/operating-decision-engine.test.ts tests/operating-context.test.ts` | 2 files, 13 passed, exit 0 |
| `pnpm exec vitest run --exclude tests/founder-windows-startup.test.ts --exclude tests/iris-dev-github.test.ts` | 63 files, 526 passed, 1 skipped, exit 0 |
| `pnpm verify` | `format:check`, `contract:compile`, `build`, `lint`, `typecheck` pass; 544 of 547 tests pass |

Test count moved from 545 to 547: one defect-asserting test was replaced by three. The two remaining failures are `tests/founder-windows-startup.test.ts` and `tests/iris-dev-github.test.ts`, which require the sibling Founder Command Center workspace and the GitHub CLI. Both fail identically at clean `main` in this container and are unrelated to this change.

## Contract integrity

The compiled operating contract digest is unchanged at `sha256:9ba317acac51f3592fb16db0f7c1beef49b867eb5759f5803230964753b1327a`. The five decision outcomes and the nine protected effects are untouched. `config/iris-operating-contract.v1.json` and `generated/**` were not modified, and no digest-bound source was edited.

## Interaction with the gateway repair

The sibling task `gateway-status-shortcut-false-completion` excludes this file, and this task excludes `scripts/local-gateway.mjs` and that task's record. Neither weakens the other: the gateway repair stops the shortcut from firing on structured objectives; this repair stops any caller from asserting completion.

**Behavior change requiring a Founder merge-order decision.** Until the gateway repair ships, an utterance containing `status`, `health`, `what are you doing`, or `active workers` still reaches the shortcut, which still asserts `terminal: { state: "completed" }`. Core will now throw instead of returning a canned report. This converts a silent false completion into a loud failure — the intended direction, and consistent with the fail-closed behavior recorded as correct in `52b0c41` — but it is visible at runtime.

## Negative evidence

- No existing test was deleted, skipped, or loosened. One test that asserted the defect was inverted to assert the guard, justified in the specification; net test count rose by two.
- No guard, fail-closed path, approval consumption, or protected-path enforcement was weakened.
- The certification program, the recorded Test One failure, and all historical results are unmodified.
- No dependency was added, removed, or updated; the `pnpm-lock.yaml` digest is unchanged.
- No secret, credential, or provider resource was involved.

## Limitations

- The follow-on design, Core-verified per-requirement evidence before accepting a completion, is not implemented. It requires a stated-requirements representation in the objective contract. The chosen design is a strict subset, so it does not need to be undone first.
- `packages/kernel/src/operating-context.ts` parses the same objective schema, so an asserted completion is rejected there as a Zod enum mismatch rather than the named error. Fail-closed in both paths; only the message differs.
- The repair is proven by test, not by a live runtime exercise. A rerun of Certification Test One after the gateway repair is the real confirmation, and it is out of scope here.
- This record is producer-authored and has not been independently reviewed.
