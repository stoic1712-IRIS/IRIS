# Verification Pre-flight and Contract-Bound Source Guard

**Status:** Approved under task `verification-preflight-ci-and-contract-source-guard`; candidate for canonical status until merged into `main`

**Prepared:** 2026-08-12

## Why these controls exist

Two outages in two days shared one cause. A digest-bound source of the canonical operating contract was edited, its SHA-256 changed, `pnpm contract:compile` failed with `OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH`, and the Founder runtime would not start. Both times the change was Markdown only, so full verification looked unnecessary and was skipped.

- Commit `52b0c41` records the first: PR #104 amended `docs/governance/constitution.md`.
- The remote-control delivery reproduced it against `docs/registries/technology-and-platform-registry.md`.

Before these controls, nothing verified a pull request. The only workflow was a manual graduation-resource job, so a skipped verification reached `main` unchallenged.

The two controls are layered deliberately: the guard gives fast local feedback at the moment of the edit, and the pre-flight is the enforcement that cannot be talked out of running.

## Control 1 — Verification pre-flight in CI

`.github/workflows/verify.yml` runs on every pull request and on push to `main`.

It runs `format:check`, `contract:compile`, `build`, `lint`, `typecheck`, the test suite, and `diagnostics`. Permissions are `contents: read`, credentials are not persisted, no secret or variable is referenced, and only the first-party `actions/checkout` and `actions/setup-node` are used. A concurrency group cancels superseded runs.

**This is a pre-flight, not the authoritative full check.** Two test files are excluded because they depend on the environment rather than on the change:

| Excluded file | Requires |
| --- | --- |
| `tests/founder-windows-startup.test.ts` | the canonical Founder Command Center workspace beside the repository |
| `tests/iris-dev-github.test.ts` | the GitHub CLI and network preconditions |

Both fail identically at clean `main` in a bare container, so excluding them hides no regression introduced by a change. A workstation `pnpm verify` remains the authoritative run and is still required before merge.

The Node version is pinned explicitly in the workflow rather than read from the `engines` range, so the CI runtime matches the workstation evidence. Keep it in sync with `engines.node` in `package.json`.

**Known follow-up:** making those two tests environment-independent would let CI run the complete suite. That is a separate objective and is not authorized here.

## Control 2 — Contract-bound source guard

`scripts/hooks/contract-bound-source-guard.mjs` is registered in `.claude/settings.json` as a `PreToolUse` hook matching `Edit`, `Write`, and `NotebookEdit`.

When an edit targets one of the sources pinned in `config/iris-operating-contract.v1.json`, the guard returns a permission prompt naming the file, its role, its pinned digest, the failure that will follow, and the rebind procedure. For any other path it stays silent.

It reads the bound source list **at runtime** rather than hardcoding it, so it stays correct as the contract evolves. There are currently eleven bound sources; the guard never needs updating when that set changes.

**The guard never blocks.** Malformed input, an absent `file_path`, a missing contract configuration, a path outside the repository, or any unexpected error all exit 0 with no decision. A broken guard degrades to no guard, never to blocked work.

**Windows note:** the hook command uses `$CLAUDE_PROJECT_DIR`. Confirm expansion on the Founder workstation. If it does not expand, replace the command with the repository-relative form `node scripts/hooks/contract-bound-source-guard.mjs`; the script locates the repository root from its own path, so it works either way.

## Rebinding a contract-bound source

When a bound source genuinely must change:

1. Edit the source.
2. Update its digest in `config/iris-operating-contract.v1.json`.
3. Run the compiler without `--check` to regenerate `generated/iris-operating-contract.compiled.json`.
4. Run `pnpm verify`.
5. Record that the contract digest moved, and confirm no clause, capability, decision outcome, or protected effect changed.

Commit `52b0c41` is the worked example.

## Removal

Delete `.github/workflows/verify.yml` to remove the pre-flight. Delete the `hooks` key from `.claude/settings.json` to remove the guard; the script is inert unless registered. Neither control owns state, and removing either affects nothing else.

## Authority references

- Task record: `.iris/coordination/tasks/verification-preflight-ci-and-contract-source-guard.json`
- Evidence: `evidence/verification-preflight/ci-and-contract-source-guard.md`
