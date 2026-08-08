# IRIS Workflow CLI Design

## Purpose

Provide one deterministic `iris-workflow` command surface that IRIS and Codex can invoke for repeated local runtime, verification, candidate, and evidence workflows. The CLI reduces manual command chains without replacing IRIS governance, granting authority, or removing any existing capability.

## Architecture

- The authoritative implementation lives in IRIS Core under `scripts/workflow/`.
- A root `pnpm workflow -- ...` script exposes it to IRIS-owned execution.
- A personal Codex skill contains only a thin wrapper and usage guidance. It delegates to the checked-in Core CLI instead of duplicating logic.
- Existing launchers, worker runtimes, proposal machinery, and the separate `iris-dev` evidence helper remain available and unchanged except where the workflow CLI calls them.

## Command Surface

| Command | Behavior | Mutation boundary |
| --- | --- | --- |
| `doctor` | Inspect tools, roots, repository state, and loopback services. | Read-only |
| `status` | Report selected Command Center root and runtime/service status. | Read-only |
| `start` | Start the complete canonical local stack through the existing PowerShell launcher and wait for the gateway. | Local processes only |
| `verify` | Run focused or full verification with network-disabled package-manager settings and no install. | Build/test artifacts only |
| `candidate inspect` | Report branch, revision, changes, and registration for one exact worktree. | Read-only |
| `candidate clean` | Remove only an exact registered, clean, non-canonical worktree under the projects root after exact-path confirmation. | Exact disposable worktree only |
| `upgrade propose` | Invoke the existing non-executable self-upgrade proposer and require output outside the repository. | External proposal file only |
| `report` | Emit a combined deterministic JSON report and optionally write it outside the repository. | Read-only unless an output path is supplied |

There is deliberately no stage, commit, push, merge, deployment, credential, spending, repository-administration, destructive-data, force-push, history-rewrite, or approved-upgrade execution command.

## Data and Error Handling

Every command supports `--json`. Structured output contains `ok`, exact roots, bounded status, and actionable errors. Unknown commands, unsafe paths, absent dependencies, dirty cleanup targets, non-registered worktrees, inaccessible services, and incomplete startup fail closed. Health probes never expose credentials or response bodies beyond bounded status metadata.

### Cold-start readiness

`start` polls the complete Founder runtime every 500 milliseconds for up to 120 seconds. It returns immediately once gateway, voice, and search are all ready, but it does not report failure merely because a healthy SearXNG cold start exceeds the former 30-second window. If the complete stack is still unavailable after 120 seconds, startup continues to fail closed with the launcher process identifier preserved in the error.

## Testing

Behavior tests execute the real CLI against disposable repositories and local fixture services. They prove command parsing, canonical Command Center selection, read-only status, complete-launcher delegation, readiness after the former 30-second boundary, offline verification environment, safe candidate cleanup refusal, and personal-wrapper delegation. The existing launcher tests remain part of the full suite.

## Scope

This package is additive runtime-workflow hardening. It does not alter Phase 0 graduation evidence, existing workers, model routing, governance, capability registries, or Founder approval semantics. Implementation and local verification are authorized; staging and publication are not.
