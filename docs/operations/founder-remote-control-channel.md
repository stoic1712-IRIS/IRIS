# Founder Remote-Control Channel Operating Rule

**Status:** Founder-approved under task `claude-code-remote-control-operator-channel`; candidate for canonical status until merged into `main`

**Prepared:** 2026-08-12

**Source:** Official Claude Code Remote Control documentation at `code.claude.com/docs/en/remote-control`, consulted 2026-08-12 against Claude Code baseline `2.1.228`

## Purpose

This document defines the exact operating boundaries for Founder use of Claude Code Remote Control, the research-preview feature that lets claude.ai/code or the Claude mobile app steer a Claude Code session running on the Founder workstation. It implements the registry disposition recorded in `docs/registries/technology-and-platform-registry.md` and `docs/registries/dependency-attribution-registry.md`.

Remote Control is an external, replaceable provider feature. It may accelerate Founder steering; it may not own IRIS identity, governance, canonical memory, approvals, audit, or worker policy.

## What the Channel Is

- The Claude Code process, code execution, and filesystem access stay on the Founder workstation. The web and mobile interfaces are a window into that local session.
- The connection is outbound HTTPS only; no inbound port is opened. Short-lived, single-purpose credentials establish the link.
- While connected, the session transcript — messages, responses, and tool activity — is stored on Anthropic servers to keep devices in sync. The project treats that stored transcript as disclosure.

## Operating Rules

1. **Workstation-only start.** A Remote Control session may be started only from the Founder workstation IRIS worktree (`C:\Projects\...\IRIS` or its WSL2 equivalent). Never start one from a cloud container, Claude Code on the web session, shared machine, CI environment, or any host the Founder does not control.
2. **No new authority.** The channel carries authenticated Founder steering of an existing local session and nothing more. Input arriving through claude.ai or the mobile app is Founder instruction only when it is the Founder speaking in their authenticated session. Any web page, retrieved document, attachment, or model output the channel forwards remains untrusted data under the website and browser rules in `docs/operations/stoic-iris-project-context.md`.
3. **Explicit invocation only.** Start the channel with `claude remote-control`, `claude --remote-control`, or `/remote-control` when needed. The auto-connect setting (`remoteControlAtStartup`) must never be enabled through checked-in project configuration (`.claude/settings.json` or `.claude/settings.local.json`); Claude Code itself ignores a checked-in `true`, and this project additionally forbids committing one.
4. **No secrets.** No credential, token, or secret may appear in session names, prompts, pasted content, or transcripts. The transcript-on-server data flow makes the existing secrets policy strictly binding here.
5. **Organization settings are Founder-only actions.** Enabling or changing the claude.ai Remote Control toggle, Trusted Devices, or any admin setting is an exact Founder account action, never an operator or agent action.
6. **Session hygiene.** Prefer named sessions started from the IRIS worktree so the session list stays attributable. Disconnect or end sessions when the objective completes. A session that dies with the local process grants nothing remotely afterward.

## Known Preconditions and Limits

- Requires an eligible claude.ai subscription login; API keys and long-lived setup tokens do not work.
- Requires the `api.anthropic.com` endpoint; gateways, Bedrock, Vertex, and Foundry are incompatible.
- `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and `DISABLE_GROWTHBOOK` each disable the feature-flag evaluation the feature depends on.
- The local process must keep running; an extended network outage of roughly ten minutes ends the session.

## Removal and Replacement

The channel is removed by not invoking it; nothing in this repository depends on it. The `disableRemoteControl` setting can disable it entirely on a device. Replacement candidates (any future IRIS-owned steering surface, including a governed Founder Command Center channel) require their own registry entries and task records before adoption.

## Authority References

- Task record: `.iris/coordination/tasks/claude-code-remote-control-operator-channel.json`
- Evidence: `evidence/remote-control/claude-code-remote-control-adoption.md`
- Registries: `docs/registries/technology-and-platform-registry.md`, `docs/registries/dependency-attribution-registry.md`
