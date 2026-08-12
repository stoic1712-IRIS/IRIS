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

## Limitations

- `pnpm verify` could not run in the research environment because workspace dependencies are not installed and the task prohibits dependency installation; it remains the acceptance command to run on the Founder workstation before merge.
- `node scripts/dev/iris-dev.mjs contract inspect --json` could not run for the same reason; the compiled contract `generated/iris-operating-contract.compiled.json` was validated directly (version `1.0.0`, digest `sha256:9ba317acac51f3592fb16db0f7c1beef49b867eb5759f5803230964753b1327a`).
- The hash-bound workstation source library was unreachable from the cloud environment; this task is coordination- and registry-scoped and does not amend governance, so foundation-source verification was not required and was not claimed.
