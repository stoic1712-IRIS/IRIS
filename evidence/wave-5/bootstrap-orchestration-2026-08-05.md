# Wave 5 Bootstrap Orchestration Adapter Evidence

**Date:** 2026-08-05
**Branch:** `iris/wave-5-bootstrap-orchestration`
**Baseline:** `d6dd53eba4b0d891482a25461384683d5539b3ad`
**Status:** Decision gate passed and evidence canonical

## Decision-gate result

The Wave 5 candidate is locally operable, properly identified and licensed, auditable, bounded, and removable. IRIS owns the execution request, policy, authentication boundary, timeout, cancellation, lifecycle events, audit meaning, idempotency, and provider-result validation. OpenClaw owns none of those permanent responsibilities.

## Deterministic contract proof

The Wave 5 tests prove:

1. A correctly authenticated synthetic request executes only inside its task workspace and records every provider-reported action.
2. Invalid authentication is denied before provider invocation and does not consume the request idempotency key.
3. Unapproved tools and paths are denied before provider invocation.
4. Network access, browser use, elevation, Docker-socket access, canonical-repository mounting, and non-synthetic data are impossible in the accepted request schema.
5. A provider-reported tool or target expansion is rejected and cancelled.
6. IRIS terminates and cancels work at its own timeout boundary.
7. Repeated successful execution is suppressed by idempotency key.
8. The same IRIS contract returns a safe unavailable result when the external provider is disabled.
9. Lifecycle events and the local SHA-256 audit chain remain intact.
10. The OpenClaw provider identity is immutable and isolated behind a replaceable transport.

## Disposable provider proof

The diagnostic `scripts/diagnostics/wave-5-openclaw-sandbox.ps1` ran the already-cached image at the exact approved digest. Provider metadata and runtime inspection proved:

- image digest `sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac`;
- source revision `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`;
- MIT license declaration;
- configured non-root user `node` and runtime UID 1000;
- network mode `none` and no exposed or published port;
- read-only root filesystem;
- every Linux capability dropped;
- `no-new-privileges` enabled;
- 512 MiB memory, one CPU, and 128-process limits;
- zero host or volume mounts;
- no canonical-repository mount and no Docker-socket mount; and
- synthetic temporary state held only in bounded tmpfs mounts.

The OpenClaw CLI returned the expected `2026.7.1` version family. The proof did not start a gateway, invoke a model, execute a tool, contact a network, or receive any credential.

## Failure and repair record

- The first timeout test exposed a race between the provider abort rejection and IRIS's timeout rejection. IRIS now records its own timeout as the authoritative cause by rejecting the timeout boundary before signalling provider abort.
- The first sandbox run used automatic container removal, which erased short-lived failure evidence. Cleanup was changed to an explicit `finally` removal of the exact container name.
- The second sandbox run exposed Windows native-command quoting around a shell expression. The diagnostic was repaired to keep the container alive with a direct command and inspect UID and CLI version using exact `docker exec` calls.

All failed proof containers were removed by the diagnostic's exact-name cleanup guard.

## Cleanup and provider-authoritative zero state

After the passing proof, Docker reported zero containers matching `iris-wave5-openclaw-proof`. The proof created no named volume, network, image, external account, credential, public listener, paid resource, or persistent workspace. The pre-existing immutable image remains only as a stopped local cache and is explicitly reported rather than silently deleted.

## Rollback and removal

Before dependent Wave 6 behavior exists, revert the bounded Wave 5 merge commit. Disable or remove the provider transport; IRIS contract tests continue through `DisabledExecutorAdapter`. No canonical state is owned by OpenClaw and no provider migration is required.

## Phase 0 boundary

Wave 5 does not complete Phase 0. It supplies a removable execution-runtime boundary only. The permanent graduation criterion still requires a genuine Founder-operated, deployed, governed multi-file self-upgrade performed by IRIS without Claude or Codex modifying the repository during that graduation workflow.
