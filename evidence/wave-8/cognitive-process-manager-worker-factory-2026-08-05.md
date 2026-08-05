# Wave 8 Verification Evidence

**Date:** 2026-08-05

**Branch:** `iris/wave-8-worker-factory`

**Baseline:** `4ec8d7d7d354f8844bd5ba951661414f21925dbc`

## Implemented Scope

- `@stoic-iris/workers` package
- complete worker identity, mission, reasoning, permission, memory, tool, network, resource, success, cleanup, and model schemas
- worker specification generation and read-only-before-coding gate
- context assembly and memory/path scoping
- minimum-permission calculation
- capability/resource-aware model assignment
- disposable workspace/runtime adapter boundary
- worker launch, output collection, lifecycle event publication, termination, and cleanup verification
- timeout, revocation, permission-expansion denial, failure handling, and cleanup-failure handling
- deterministic Repository Cartographer worker and disposable Docker proof

## Automated Verification

The certified Ubuntu toolchain uses Node.js `24.19.0` and pnpm `11.20.0`. Vitest reported 12 passing test files and 76 passing tests, including 11 Wave 8 tests. The tests prove minimum read-only permissions, coding-worker denial, scoped context, bounded model assignment, no delegation, successful lifecycle events, pre-launch revocation, reported-permission denial, timeout termination, cleanup, and cleanup-failure closed behavior.

## Repository Cartographer Acceptance Proof

Runtime image: `node@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43`.

The acceptance worker operated on an archive-derived disposable snapshot of canonical `origin/main`. The runtime configuration was inspected before launch and verified:

- Docker network `none`;
- read-only root filesystem;
- exactly one read-only snapshot mount;
- non-root UID/GID `1000:1000`;
- all Linux capabilities dropped;
- no-new-privileges enabled;
- zero published ports and zero injected secrets;
- one CPU, 256 MiB memory, 64-process limit; and
- 16 MiB no-exec temporary filesystem.

Repository Cartographer reported 126 files, 7 packages, and 11 tests. Counts and citations exactly matched independent host execution of the deterministic inspector. It had no internet, commit, push, merge, deployment, Git credential, Docker socket, delegation, self-approval, or permission-expansion authority.

The exact container `iris-wave8-repository-cartographer` was removed in `finally`. The GUID-named workspace was verified under the operating-system temporary root before recursive removal. Post-cleanup checks found neither the container nor workspace.

## Limits

No coding worker was created or enabled. No model-generated reasoning was needed for this deterministic acceptance worker. No persistent service, external network, production data, credential, deployment, paid resource, or canonical-memory mutation was introduced.

## Gate Result

Passed. The read-only worker lifecycle succeeds, and workers cannot delegate or expand permissions without IRIS authorization.
