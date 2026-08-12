# Evidence: Verification Pre-flight and Contract-Bound Source Guard

**Task:** `.iris/coordination/tasks/verification-preflight-ci-and-contract-source-guard.json`

**Producer:** Claude (cloud session on branch `claude/remote-control-v1owqp`)

**Date:** 2026-08-12

**Base:** `stoic1712-IRIS/IRIS` `main` @ `08f69f82846e40d1a428f4238da5f14918965fa1`

## Producing environment

Raised to the repository-pinned toolchain so acceptance commands could actually run: Node `24.19.0` via the container's nvm (default was `22.22.2`, below the `>=24.19.0 <25` engine pin) and pnpm `11.20.0` via corepack. `pnpm install --frozen-lockfile --ignore-scripts` returned exit 0 with 244 packages; the `pnpm-lock.yaml` digest `1fdce7147ce568614a2c07e74d52ee7603fe0b415cfb50e7cdf32048afa833a2` is identical before and after, so no dependency was added, removed, or changed.

## Guard behavior

Each case was executed against `scripts/hooks/contract-bound-source-guard.mjs` by piping a PreToolUse payload to stdin.

| # | Input | Result | Exit |
| - | --- | --- | --- |
| 1 | `docs/registries/technology-and-platform-registry.md`, relative | `ask`, naming role `registry` and pin `sha256:4da79b5d…` | 0 |
| 2 | `/home/user/IRIS/docs/governance/constitution.md`, absolute | `ask`, naming role `origin` and pin `sha256:5dfea310…` | 0 |
| 3 | `README.md` | no output | 0 |
| 4 | `docs/registries/dependency-attribution-registry.md` | no output | 0 |
| 5 | malformed JSON | no output | 0 |
| 6 | payload with no `file_path` | no output | 0 |
| 7 | empty stdin | no output | 0 |
| 8 | `/etc/hosts`, outside the repository | no output | 0 |

Cases 1 and 2 confirm detection through both relative and absolute paths and correct digest reporting. Case 4 is the discriminating case: the dependency attribution registry is **not** contract-bound, and the guard correctly stays silent, so it distinguishes the two registries rather than matching on directory. Cases 5 through 8 confirm fail-open behavior; no input produced a non-zero exit or a blocking decision.

The bound list is read from `config/iris-operating-contract.v1.json` at runtime. Eleven sources are currently pinned. The guard requires no update when that set changes.

## Settings integrity

Compared parsed `.claude/settings.json` at `main` against the working copy:

- `permissions.allow` — identical, 24 entries
- `permissions.ask` — identical, 36 entries
- `permissions.deny` — identical, 65 entries
- `permissions.defaultMode`, `permissions.disableBypassPermissionsMode`, `autoMemoryEnabled` — identical
- Keys added: `["hooks"]`. Keys removed: none.

No existing allow, ask, or deny rule was modified, reordered, or removed. The change is purely additive.

## Workflow properties

`.github/workflows/verify.yml` declares `permissions: contents: read`, sets `persist-credentials: false` on checkout, references no secret or variable, and uses only the first-party `actions/checkout@v4` and `actions/setup-node@v4`. A concurrency group cancels superseded runs and the job carries a 20-minute timeout. The existing `wave-10-resource-proof.yml` is untouched.

Node is pinned explicitly at `24.19.0` rather than resolved from the `engines` range, so the CI runtime matches the workstation evidence exactly.

## Excluded tests and their justification

`tests/founder-windows-startup.test.ts` fails with "The canonical Founder Command Center workspace was not found" because the sibling repository is absent. `tests/iris-dev-github.test.ts` times out without the GitHub CLI and network preconditions.

Both were executed against clean `main` @ `08f69f82846e40d1a428f4238da5f14918965fa1` in the same container and failed identically there. That establishes them as environmental and pre-existing, so excluding them from the pre-flight hides no regression introduced by a change. With them excluded, the suite is fully green: 63 files, 524 passed, 1 pre-existing skip.

## Verification

- `pnpm exec vitest run --exclude tests/founder-windows-startup.test.ts --exclude tests/iris-dev-github.test.ts`: 63 files, 524 passed, 1 skipped, exit 0.
- `pnpm diagnostics`: exit 0, confirmed standalone because it never executes in a full `pnpm verify` run that fails at the test step.
- `pnpm verify`: `format:check`, `contract:compile`, `build`, `lint`, and `typecheck` pass; 542 of 545 tests pass with 1 pre-existing skip; the two environmental files above account for the remainder.

## Negative evidence

- No secret, token, credential, variable, or environment value was created, read, referenced, or stored.
- No branch protection, ruleset, required-check configuration, or repository or organization setting was changed.
- No digest-bound contract source, `config/iris-operating-contract.v1.json`, or `generated/**` output was modified. `docs/registries/**` was excluded from this task precisely because the technology and platform registry is itself a bound source.
- No dependency was added, removed, or updated.
- The existing graduation-resource workflow was not modified.

## First live workflow execution

Run `31596726784`, triggered by `pull_request` on PR #109 at head `9d02f053aa22e260aa71c391b1687b1e03ab9fb1`, **concluded `success`** in 88 seconds (12:30:05Z to 12:31:33Z). Every step passed:

| # | Step | Result |
| - | --- | --- |
| 2 | Check out the exact revision | success |
| 3 | Use the repository-pinned Node version | success |
| 4 | Activate the repository-pinned pnpm | success |
| 5 | Materialize dependencies without changing the lockfile | success |
| 6 | Formatting | success |
| 7 | Operating contract source digests and compiled output | success |
| 8 | Build | success |
| 9 | Lint | success |
| 10 | Type check | success |
| 11 | Tests, excluding environment-dependent files | success |
| 12 | Repository diagnostics | success |

Step 7 is the control that would have caught both recorded outages. The workflow is therefore proven end to end on GitHub's runner, not only reasoned about.

## Limitations
- `$CLAUDE_PROJECT_DIR` expansion in the hook command is unverified on the Founder's Windows workstation. The operations document records the repository-relative fallback.
- GitHub Actions consumption for this workflow is assumed free under public-repository terms, consistent with the repository's Founder-approved public visibility. No billing state was inspected.
- The guard covers Claude Code tool calls only. It does not intercept edits made by Codex, a shell command, an editor, or any other path. CI is the control that catches those.
- This record is producer-authored and has not been independently reviewed.
