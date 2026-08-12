# Evidence: Claude Code Remote Control Channel Adoption

**Task:** `.iris/coordination/tasks/claude-code-remote-control-operator-channel.json`

**Producer:** Claude (cloud research session on branch `claude/remote-control-v1owqp`)

**Date:** 2026-08-12

## Research Provenance

- Official documentation `code.claude.com/docs/en/remote-control` was fetched read-only on 2026-08-12 and is the sole external source for the registry rows and operations document. No other website, install, download, credential, or account action occurred.
- Observed Claude Code baseline in the research environment: `claude --version` → `2.1.228 (Claude Code)`.
- Repository base at research time: `stoic1712-IRIS/IRIS` `main` @ `08f69f82846e40d1a428f4238da5f14918965fa1`; task record created at `283ce9d53df9a4ab5e535bb6cfd18e1a0ac35183`.

## Key Verified Facts Recorded in the Registries

- Remote Control runs the Claude Code process, execution, and filesystem access on the local machine; web/mobile clients are a window into that session.
- Outbound HTTPS only; no inbound ports; multiple short-lived single-purpose credentials.
- The session transcript is stored on Anthropic servers while connected; the project treats this as disclosure.
- Requires claude.ai subscription login, the `api.anthropic.com` endpoint, and feature-flag evaluation; incompatible with API keys, setup tokens, gateways, Bedrock, Vertex, Foundry, and the telemetry-disabling environment variables named in the operations document.
- Checked-in project settings cannot enable auto-connect (`remoteControlAtStartup: true` is ignored from project files by Claude Code itself); this project additionally prohibits committing one.

## Negative Evidence

- No Remote Control session was started from this cloud research environment or any non-Founder environment during this task. The environment lacks a claude.ai interactive login for the CLI, and the operations rule prohibits it regardless.
- No dependency was installed or updated; `node_modules` was never materialized.
- No secret, token, or credential was read, displayed, or stored.
- No claude.ai organization, admin, or Trusted Devices setting was viewed or changed.

## Founder Approval

- 2026-08-12: the Founder instructed creation of the governed remote-control task record in the authenticated Claude session on branch `claude/remote-control-v1owqp`.
- 2026-08-12: the Founder stated "I approve the record, proceed with the registry rows and operations doc", approving task `claude-code-remote-control-operator-channel` and authorizing this bounded implementation. The approval reference recorded in the task is `founder-remote-control-record-approval-2026-08-12`.

## Contract-bound source defect and correction

The first delivery of this task added a "Founder remote steering" row to `docs/registries/technology-and-platform-registry.md`. That file is one of eleven digest-bound sources of the canonical operating contract, pinned in `config/iris-operating-contract.v1.json` at `sha256:4da79b5d63e3ee48499248ebb15e65e06136cce879406ca9103efcd28646e750`. The edit changed the file digest to `sha256:a90490edf7853169b0b7baac250dde117e661f8acfac502d801f06fc53d1f113`, so `pnpm contract:compile --check` failed with `OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH` and the Founder runtime would have failed closed on startup.

This reproduced the outage recorded in commit `52b0c41`, where an amendment to the contract-bound constitution shipped without full verification because the change was Markdown only. The same reasoning caused this one: the producer reported that verification was not runnable and delivered anyway.

Correction applied: the technology and platform registry was reverted to its `main` content and its digest now matches the pin exactly. Two consequences were recorded rather than worked around.

1. **Deviation from the approved objective.** The approved task objective names rows in both registries. Only the dependency attribution registry row was delivered. The technology and platform registry is deliberately left unchanged because it is contract-bound and describes IRIS's own capability and authority surface, whereas Remote Control is an external operator interface conferring no IRIS capability. Claude Code itself is absent from that registry, which is the governing precedent. Recording Remote Control there would change the canonical contract digest for a non-capability item and invalidate digest citations in existing evidence. The Founder may direct the alternative: add the row, rebind `config/iris-operating-contract.v1.json`, and recompile, following the procedure in `52b0c41`.
2. **The task record as approved is unsatisfiable.** Its `allowed_paths` permit editing the contract-bound registry while its `excluded_paths` forbid `generated/**`, and it does not permit `config/iris-operating-contract.v1.json`. A task cannot legitimately change a bound source without the rebinding that must accompany it. This is a defect in the record's scoping, not in the producer's execution of it, and it is reported for the Founder's decision.

## Verification performed

The producing environment was brought up to the repository-pinned toolchain so the acceptance command could actually run:

- Node `24.19.0` installed through the container's `nvm` to satisfy the `>=24.19.0 <25` engine pin; the container default was `22.22.2`.
- `pnpm 11.20.0` activated through corepack, matching `packageManager`.
- `pnpm install --frozen-lockfile --ignore-scripts`: exit 0, 244 packages, lifecycle scripts disabled, supply-chain policy passed. `pnpm-lock.yaml` digest `1fdce7147ce568614a2c07e74d52ee7603fe0b415cfb50e7cdf32048afa833a2` before and after, so no dependency was added, removed, or changed.
- `pnpm verify` after the correction: `format:check`, `contract:compile`, `build`, `lint`, and `typecheck` all pass; 542 of 545 tests pass with 1 pre-existing skip.

## Limitations

- Two test files fail in this container and are **not** caused by this change: `tests/founder-windows-startup.test.ts` fails with "The canonical Founder Command Center workspace was not found" because the sibling repository is not present, and `tests/iris-dev-github.test.ts` times out without the GitHub CLI and network preconditions. Both were run against clean `main` at `08f69f82846e40d1a428f4238da5f14918965fa1` in the same container and fail identically there, which establishes them as environmental and pre-existing. Full green therefore still requires a Founder workstation run.
- The hash-bound workstation source library was unreachable from the cloud environment; this task is coordination- and registry-scoped and does not amend governance, so foundation-source verification was not required and was not claimed.
