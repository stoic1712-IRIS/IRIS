# Founder Windows Lifecycle

**Status:** Implemented candidate

**Owner:** IRIS Core

## Commands

The canonical workflow entrypoint is `node scripts/workflow/iris-workflow.mjs` with:

- `runtime status|start|stop|restart|repair --json`
- `runtime install-startup|remove-startup [--what-if] --json`

The lifecycle owns only processes it starts, records non-secret metadata beneath `%LOCALAPPDATA%\STOIC-IRIS\runtime`, and health-gates the loopback gateway, neural voice, SearXNG, and Ollama endpoints. Startup opens the browser only after all required checks pass. Failure rolls back only owned child processes and reports the exact failed service.

The per-user Windows Scheduled Task is non-elevated, idempotent, repairable on drift, and invokes the canonical workflow launcher without embedding credentials. Removal targets only that exact task.

## Greeting

Core emits one boot-bound `founder.greeting-ready` marker after voice health. The authenticated Command Center consumes it, requests the local neural voice, plays “Hello, Founder” once, deletes the transient WAV, and atomically records consumption. Core never synthesizes speech and there is no robotic system-voice fallback.

## Boundaries and rollback

Every service remains bound to loopback. Full access is never persisted across restart. `runtime stop` and `runtime remove-startup` are the bounded rollback controls. Lifecycle readiness is operational evidence, not Phase 0 graduation.
