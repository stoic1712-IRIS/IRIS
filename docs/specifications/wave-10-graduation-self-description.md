# Wave 10 Graduation Self-Description

## Purpose

The development package exposes a deterministic description of the sovereign development runtime's governed capabilities and current graduation status.

## Contract

- The system name is `STOIC-IRIS`.
- The runtime is `sovereign-development-runtime`.
- Capabilities appear in the canonical order encoded by the implementation and tests.
- `graduationEvidenceComplete` is `false` until deployed IRIS performs the permanent Founder-operated graduation criterion under the current canonical project context.

## Immutability and determinism

Each call returns a distinct object and capabilities array. Both are frozen. Their values and order remain deterministic.

## Validation

Tests verify the exact capability list, frozen object and array, truthful incomplete graduation status, and distinct identities across calls. The standard format, lint, typecheck, test, build, diagnostics, and independent verification checks remain mandatory.

## Graduation boundary

The earlier Wave Ten proof validated important sovereign-development machinery, but it does not satisfy the newer permanent deployed Founder-operated graduation criterion. The status may change to `true` only after IRIS herself completes and records the exact typed approval, real-model canonical multi-file upgrade, private checkpoint, independently reviewed delivery and merge, canonical-main equality, rollback ancestry, cleanup, paid-resource termination, and provider-authoritative zero-resource verification while Claude and Codex remain audit-only.
