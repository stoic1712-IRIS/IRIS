# ADR-004: Bootstrap Orchestration Adapter

**Status:** Canonical; Wave 5 bounded adapter implemented and verified

**Date:** 2026-08-04

**Owners:** Founder and IRIS Core

**Related wave/capability:** Waves 2 and 5; Bootstrap Orchestration Adapter

## Context

OpenClaw and Hivemind can accelerate tools, browser work, messaging, scheduling, delegation, and background execution. Both also overlap permanent IRIS responsibilities and expose broad execution authority. Gamut demonstrates useful container and credential-proxy patterns but lacks an approved immutable software and licensing identity for adoption. Shoal remains unidentified.

## Decision Drivers

Minimum authority, local-only evaluation, explicit authentication, sandbox enforcement, auditable actions, no canonical memory ownership, removable adapters, permissive redistribution posture, no host Docker control by default, and no external credentials during evaluation.

## Options Considered

- OpenClaw `2026.7.1-2`, MIT: extensive runtime features and official image; unconfigured security audit found missing gateway authentication, unauthenticated HTTP tools, enabled elevated tools and browser control, and a single-operator trust model.
- Hivemind `2026.07.01`, AGPL-3.0: rich multi-agent topology; eleven services, Docker-socket proxy, broad installer behavior, and distribution/network-use obligations.
- Gamut: useful isolation, scoped-secret, OAuth-proxy, and policy concepts; adoption identity and terms unresolved.
- Shoal: exact identity, source, version, and license unresolved.
- IRIS-native executor: maximum sovereignty but requires more implementation effort.

## Decision

Do not adopt or fork an external orchestrator during Wave 2. Permit a later disposable OpenClaw proof only through an IRIS-owned adapter after the Kernel and Coordination contracts exist. Treat Hivemind and Gamut as pattern sources, not embedded Core dependencies. Block Shoal until exact identity is established.

Any OpenClaw proof must use a digest pin, non-root container, read-only root, no host repository mount, no Docker socket, no network by default, explicit gateway token, disabled elevated tools, disabled browser until separately approved, task-scoped workspace, synthetic data, bounded resources, complete action capture, and verified teardown.

## Consequences

IRIS retains authority and avoids premature coupling. Some ready-made integrations are delayed. Adapter and sandbox work must be implemented and tested before useful external execution is allowed.

## Verification

Prove authentication failure without a valid token, deny unapproved tools and paths, deny network by default, reject privilege expansion, record every action, terminate on timeout, remove the provider without breaking IRIS contracts, and verify complete workspace/container cleanup.

## Rollback and Removal

Stop and remove the adapter and provider containers, revoke evaluation tokens, remove synthetic state and volumes, verify zero matching resources, and run IRIS executor contract tests without the provider.

## Approval

Founder approval granted in the Founder conversation on 2026-08-04: "I approve ADR-001 through ADR-004 as the architectural direction for coordination, canonical memory, model runtime adapters, and bootstrap orchestration." Canonical effect remains pending repository commit. The approval does not authorize OpenClaw or another external orchestrator to operate against canonical resources.

## Supersession

None.
