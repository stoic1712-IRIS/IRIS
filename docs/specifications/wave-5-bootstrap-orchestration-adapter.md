# Wave 5 Bootstrap Orchestration Adapter Specification

**Status:** Local implementation candidate

## Purpose

Establish an IRIS-owned execution-runtime boundary that can use or remove a bootstrap orchestrator without transferring identity, policy, approval, canonical memory, coordination meaning, or audit authority to that provider.

## Governed execution envelope

Every request binds an authenticated gateway token to an exact objective, requester, correlation identifier, idempotency key, task-scoped workspace, tool allowlist, path allowlist, timeout, and synthetic-data declaration. The Wave 5 bootstrap profile requires network disabled, browser disabled, elevated execution disabled, Docker socket absent, and the canonical repository unmounted.

The orchestrator must reject:

- invalid gateway authentication;
- absolute paths or path traversal;
- workspaces outside the configured task root;
- tools outside the IRIS allowlist;
- targets outside the request path allowlist;
- provider-reported actions that expand tools or paths; and
- request shapes that enable network, browser, elevation, Docker control, canonical-repository mounting, or non-synthetic data.

## Lifecycle and evidence

IRIS emits started, completed, denied, and failed lifecycle events. Its local operational audit is SHA-256 linked and records no gateway token or task payload. Every provider-reported action must validate against the same tool and path boundary before its result can be accepted.

IRIS enforces its own timeout and invokes provider cancellation on timeout, provider failure, or reported authority expansion. Idempotency keys prevent a repeated request from invoking the provider twice.

## Provider decision

OpenClaw remains a replaceable bootstrap provider, not part of IRIS Core. The only approved evaluation identity is image `ghcr.io/openclaw/openclaw:2026.7.1-2` at digest `sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac`, source revision `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`, under the MIT license.

The bounded proof may inspect the pinned image and execute its CLI with synthetic state only. It may not start a network gateway, mount the canonical repository, access external credentials, expose a port, enable browser or elevated tools, mount the Docker socket, or create a paid resource.

## Completion gate

Wave 5 requires deterministic tests for authentication failure, request denial, tool and path enforcement, provider authority expansion, timeout cancellation, action capture, idempotency, provider disablement, and audit integrity. A disposable provider proof must confirm the approved immutable identity, non-root runtime, networkless execution, bounded resources, read-only root, dropped capabilities, `no-new-privileges`, task-only synthetic state, and provider-authoritative zero matching resources after cleanup.
