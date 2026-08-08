# Founder Windows Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the canonical local IRIS stack start, stop, restart, repair, report status, and register or remove per-user Windows-logon startup deterministically.

**Architecture:** Extend the existing `iris-workflow` CLI with one process-owning lifecycle controller. PowerShell remains the Windows entrypoint, while the controller records only non-secret runtime metadata under `%LOCALAPPDATA%\STOIC-IRIS\runtime`, polls every required health endpoint, rolls back processes it started on failure, and opens the Command Center only after the stack is healthy.

**Tech Stack:** Node.js 24, PowerShell 7/Windows PowerShell, WSL2, Docker Compose, Vitest, Zod.

## Global Constraints

- Preserve current WSL, Ollama, SearXNG, voice, gateway, and local-login capabilities.
- Bind all listening services to loopback; never create public or LAN exposure.
- Register a non-elevated per-user Scheduled Task only; no admin rights or secrets.
- Never persist Full access across a Windows restart.
- Every command must be idempotent and emit structured JSON in `--json` mode.

---

### Task 1: Specify and test lifecycle state

**Files:**
- Create: `packages/runtime/src/founder-windows-lifecycle.ts`
- Modify: `packages/runtime/src/index.ts`
- Create: `tests/founder-windows-lifecycle.test.ts`

1. Add failing tests for strict schemas covering `stopped`, `starting`, `healthy`, `degraded`, and `repairing`; exact process ownership; endpoint checks; boot identifier; and last greeting identifier.
2. Run `pnpm exec vitest run tests/founder-windows-lifecycle.test.ts` and confirm the missing export fails.
3. Implement `FounderWindowsLifecycleState`, `FounderRuntimeProcess`, `FounderRuntimeHealth`, and `classifyFounderRuntimeHealth()` with strict parsing and loopback URL validation.
4. Re-run the focused test and commit the exact files with `feat: define Founder Windows lifecycle state`.

### Task 2: Add deterministic lifecycle orchestration

**Files:**
- Modify: `scripts/workflow/iris-workflow-lib.mjs`
- Modify: `scripts/workflow/iris-workflow.mjs`
- Modify: `tests/iris-workflow-cli.test.ts`

1. Add failing CLI tests for `runtime status`, `runtime start`, `runtime stop`, `runtime restart`, and `runtime repair`, including partial-stack detection, timeout diagnostics, child rollback, and repeat-safe calls.
2. Add exact command dispatch and structured reports. Reuse current service launchers; record only PIDs started by this invocation; stop only verified owned processes; leave unrelated processes untouched.
3. Poll `4174`, `8765`, `8888`, and `11434`; require all checks before `healthy`; on failure, terminate only started children and report the exact failed service.
4. Run `pnpm exec vitest run tests/iris-workflow-cli.test.ts tests/founder-windows-lifecycle.test.ts` and commit with `feat: orchestrate Founder runtime lifecycle`.

### Task 3: Add Windows logon registration

**Files:**
- Create: `scripts/runtime/install-founder-startup.ps1`
- Create: `scripts/runtime/remove-founder-startup.ps1`
- Create: `tests/founder-windows-startup.test.ts`
- Modify: `scripts/workflow/iris-workflow-lib.mjs`
- Modify: `scripts/workflow/iris-workflow.mjs`

1. Add failing tests around a fake Scheduled Task adapter for exact per-user trigger, non-elevated run level, absolute canonical launcher path, repair-on-drift, repeat-safe install, and exact removal.
2. Implement `runtime install-startup` and `runtime remove-startup`. The task action invokes the canonical workflow CLI, never embeds credentials, and writes logs only beneath `%LOCALAPPDATA%\STOIC-IRIS\runtime`.
3. Add `-WhatIf` support to both PowerShell scripts and reject non-canonical or missing repository paths.
4. Run the two focused suites and commit with `feat: register Founder runtime at Windows logon`.

### Task 4: Gate browser open and one greeting per boot

**Files:**
- Modify: `scripts/runtime/start-founder-command-center.ps1`
- Modify: `scripts/runtime/start-founder-command-center.sh`
- Modify: `scripts/workflow/iris-workflow-lib.mjs`
- Modify: `tests/iris-workflow-cli.test.ts`
- Modify: `tests/founder-windows-startup.test.ts`

1. Add failing tests proving the browser opens only after all health checks and the greeting event is emitted once per boot after voice health, never once per retry.
2. Implement a boot-bound greeting marker and `founder.greeting-ready` lifecycle event. Do not synthesize speech in Core; the Command Center consumes the event.
3. Ensure startup failure cleans search, voice, and gateway processes started by the same invocation.
4. Run focused tests, `pnpm verify`, and `node scripts/workflow/iris-workflow.mjs report --json`.
5. Commit with `feat: complete deterministic Founder cold start`.

### Task 5: Document and evidence the lifecycle

**Files:**
- Create: `docs/specifications/founder-windows-lifecycle.md`
- Create: `evidence/post-roadmap/founder-windows-lifecycle-2026-08-08.md`
- Modify: `README.md`

1. Document commands, ownership, health gates, startup registration, log locations, rollback, removal, and explicit non-graduation status.
2. Record exact verification commands, exit codes, branch, commit, and live smoke-test criteria.
3. Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm diagnostics`.
4. Commit exact paths with `docs: certify Founder Windows lifecycle`.
