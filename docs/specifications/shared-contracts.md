# Shared Contracts Specification

**Status:** Draft implementation specification

**Version:** 0.1.0

**Wave:** 3 - Shared Contracts and IRIS Kernel

## Purpose

This specification activates the IRIS-owned shared-contract boundary required before Kernel, Coordination, or model-provider behavior. It derives from the canonical Constitution, Approval and Authorization Policy, Testing and Verification Standards, Repository Blueprint, and the Founder-approved Wave 2 architecture decisions.

## Scope

The `@stoic-iris/contracts` package defines runtime-validated, provider-independent structures for canonical identifiers, timestamps and versions, provenance and digests, R0-R4 risk, typed approvals, authorization decisions, audit events, runtime configuration, structured errors, and verification evidence.

## Governing Requirements

1. Every exported data boundary has a Zod schema and an inferred TypeScript type.
2. Object schemas reject undeclared fields.
3. Identifiers use a governed kind prefix followed by a UUID.
4. Timestamps require ISO 8601 offsets; completion and recording cannot precede initiation.
5. Digests use lowercase SHA-256 with an explicit `sha256:` prefix.
6. R4 actions cannot receive an allow decision.
7. Approvals bind action type, payload digest, target, executor, tools, validity, verification, cleanup, and lifecycle state.
8. A consumed approval records its consumption time; another lifecycle state may not claim consumption.
9. Errors expose only explicitly safe scalar details and retain correlation and risk context.
10. Evidence preserves revision, tools, commands, failures, repairs, limitations, rollback, cleanup, digest, and provenance.

## Exclusions

This slice does not implement objective intake, policy evaluation, persistence, event publication, provider adapters, authentication, signatures, secret storage, or external effects. Those capabilities require later bounded changes using these contracts.

## Dependencies

- TypeScript `6.0.3`
- Zod `4.4.3`
- Vitest `4.1.10`

No new dependency is introduced by this specification.

## Verification

The package must pass root formatting, linting, strict type-checking, unit tests, build, and diagnostics. Tests demonstrate valid parsing and rejection of unknown identifier kinds, invalid lifecycle state, R4 allow decisions, undeclared keys, unsafe error details, malformed digests, and reversed timestamps.

## Limitations

Schema validation establishes structure, not authenticated identity or authority. Digests are validated syntactically but are not calculated by this package. Approval authenticity, expiry relative to a trusted clock, one-time consumption, and append-only audit persistence remain Kernel responsibilities.

## Rollback

Revert the bounded shared-contract commit before dependent Wave 3 implementation. Once dependent contracts exist, rollback requires a versioned migration rather than silent schema removal.

## Completion Gate

This slice is complete when every scoped schema is exported, deterministic positive and negative tests pass, later-wave packages remain empty governed boundaries, the root verification command passes, and the Founder approves canonicalization through the repository workflow.
