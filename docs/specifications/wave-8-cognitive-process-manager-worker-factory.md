# Wave 8 Cognitive Process Manager and Worker Factory

**Status:** Implemented and verified

**Date:** 2026-08-05

## Outcome

Wave 8 introduces IRIS-owned temporary-worker contracts and the first complete worker lifecycle. The first accepted worker is deterministic and read-only. Coding workers remain disabled until this gate is canonical and a later governed wave explicitly enables modification authority.

## Worker Specification

Every worker specification fixes:

- identity, role, and zero standing authority;
- bounded mission and prohibited objectives;
- reasoning instructions, evidence requirement, and prohibitions on self-approval and delegation;
- exact tools, readable paths, writable paths, and a permanent prohibition on self-expansion;
- scoped memory categories, sensitivity ceiling, and item limit;
- command allowlist and shell disposition;
- network mode and allowed hosts;
- timeout, memory, CPU, GPU VRAM, and process limits;
- required output fields and independent verification;
- termination, workspace deletion, and zero-resource cleanup requirements; and
- replaceable model provider, model identity, and purpose.

Read-only specifications cannot contain write paths. Coding specifications cannot be generated while the read-only gate flag is false.

## Worker Factory

The Worker Factory calculates the minimum permission set from the mission rather than accepting arbitrary expansion. Read-only missions may receive only deterministic inspection tools. The Context Assembler filters repository files by allowed paths and memory by category, sensitivity, and count. The Model Assigner selects only candidates that satisfy capability and GPU-resource limits.

Worker recommendations do not grant authority. A worker may not approve itself, delegate, expand permissions, obtain broader memory, change network mode, or mutate its fixed specification.

## Cognitive Process Manager

The manager publishes worker lifecycle events for specification, start, output collection, denial/failure, termination, and verified cleanup. It fixes the specification digest before launch, rejects revoked or coding workers before workspace creation, enforces timeout, validates reported tools and paths, validates required output fields, terminates after every launched outcome, and fails closed if cleanup cannot be verified.

Runtime adapters own no identity, planning, memory, permission, or approval state. They receive a fixed specification and bounded context and return a report for IRIS validation.

## First Worker Acceptance Test

Repository Cartographer inspects an archive-derived disposable snapshot of canonical `origin/main`. A digest-pinned Node Alpine container runs as a non-root user with network `none`, read-only root filesystem, one read-only snapshot mount, all Linux capabilities dropped, no-new-privileges, no ports, no secrets, one CPU, 256 MiB RAM, a 64-process limit, and a 16 MiB no-exec temporary filesystem.

The worker emits file, package, test, and source inventories with repository citations. Its result is compared with the same deterministic inspection performed by the host. The exact container and temporary snapshot are then removed and their absence verified.

## Decision Gate

Wave 8 passes only when the complete read-only lifecycle succeeds and:

- no coding worker launches;
- no worker delegates or expands permissions without IRIS authorization;
- out-of-scope tools and paths fail closed;
- timeout, revocation, failure, termination, and cleanup paths are verified;
- output matches independent deterministic inspection; and
- worker and workspace cleanup leave zero matching resources.

## Rollback

Before a dependent wave enables additional worker types, revert the Wave 8 merge commit. No persistent runtime, worker, database, credential, network, paid resource, or external canonical state exists. The disposable acceptance container and workspace are already removed.
