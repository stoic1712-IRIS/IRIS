# Wave 10 Graduation Self-Description

## Purpose

The development package exposes a deterministic description of the sovereign development runtime's governed capabilities and current graduation status.

## Contract

- The system name is `STOIC-IRIS`.
- The runtime is `sovereign-development-runtime`.
- Capabilities appear in the canonical order encoded by the implementation and tests.
- `graduationEvidenceComplete` remains `false` until the full Founder-operated graduation workflow succeeds.

## Immutability and determinism

Each call returns a distinct object and capabilities array. Both are frozen. Their values and order remain deterministic.

## Validation

Tests verify the exact capability list, frozen object and array, incomplete graduation status, and distinct identities across calls. The standard format, lint, typecheck, test, build, diagnostics, and independent verification checks remain mandatory.

## Graduation boundary

Machinery readiness and this self-description are not Phase 0 graduation evidence. Graduation remains incomplete until IRIS completes the genuine Founder-operated governed workflow end to end, including private checkpointing, remote equality, rollback evidence, cleanup, paid-resource termination, and provider-authoritative zero-resource verification.
