# Repository Repair Approval Lifecycle Evidence

**Status:** Locally verified; publication pending

## Bound bases

- IRIS Core: `0e99a261acba77be33a90a9143d736005a60429b`
- Founder Command Center: `5723bf0bedb1bf1c0667aaff812a776ecdb5d953`

## Verified defect

- Core proposal lifetime was 120 seconds.
- Exact expired approval was rejected as designed.
- Command Center retained expired in-memory proposal state and blocked a replacement until restart.
- UI exposed only an absolute expiry timestamp and had no stale-proposal recovery control.

## Required completion evidence

## Test-first repair evidence

- The Core regression failed before implementation because a proposal was invalid at `22:09:59.999Z` and still expired at two minutes.
- The Command Center gateway regression failed before implementation because a replacement request remained `404` after the original proposal expired.
- The UI regression failed before implementation because no countdown helper or replacement control existed.
- After implementation, the focused Core suite passed `9/9`.
- After implementation, the focused Command Center suites passed `65` tests with `1` pre-existing skip.

## Full verification

- IRIS Core `pnpm verify`: exit `0`; format, build, lint, typecheck, tests, and diagnostics passed; `495` tests passed with `1` existing skip. Output digest: `sha256:dc84a575c2c71dcfee1ec741af76800ad702c1c62ba0cdf74b67ea9cac1c241b`.
- Founder Command Center `pnpm verify`: exit `0`; format, lint, typecheck, build, and tests passed; `276` tests passed with `4` existing skips. Output digest: `sha256:05b6cdb4234f393dc7d2eb6ea16df23d0e748fe7cb0be6812a4e9c2784026b36`.

## Preserved controls

- Exact digest-bound statement verification is unchanged.
- Eight-digit one-time code binding and in-memory secret clearing are unchanged and are also cleared when stale state is retired.
- Authenticated loopback session, same-origin, CSRF, and five-failed-attempt checks are unchanged.
- A live unconsumed proposal remains non-replaceable.
- Candidate-only mutation, path allowlisting, fixed verification, automatic cleanup, maximum USD `0`, and no canonical write, GitHub, network, credential, deployment, or spending authority remain unchanged.
- No repair or Phase 0 graduation proposal was approved or executed by Codex.

## Publication still required

Exact commit and pull-request identities, merged remote equality, canonical synchronization, worktree cleanup, restart health, and a non-executing proposal smoke test remain pending.
