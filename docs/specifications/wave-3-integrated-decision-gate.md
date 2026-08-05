# Wave 3 Integrated Decision Gate Specification

**Status:** Draft implementation specification

**Version:** 0.1.0

**Wave:** 3 - Shared Contracts and IRIS Kernel

## Purpose and Scope

This slice connects objective intake, authenticated actor context, policy evaluation, typed approval evaluation, one-time approval consumption, the replaceable Model Gateway, and cryptographically chained audit evidence into one fail-closed governed reasoning pipeline.

## Requirements

- Preserve a read-only objective as R0 and allow only authenticated read authority to reach the model.
- Stop R1 and unapproved R3 objectives at their exact approval boundaries without invoking the model.
- Deny R4 and contradictory policy inputs before model invocation.
- Permit an R3 reasoning request only after an issued approval exactly matches authenticated approver, action, proposal digest, target, executor, tool, validity, and prior-consumption state.
- Consume a successful typed approval once before model invocation.
- Treat model output as untrusted until the Model Gateway validates it and declares zero authority.
- Preserve provider failure, malformed output, timeout, and cancellation as safe failure results and audit events.
- Correlate every event with one canonical request identifier and maintain the append-only cryptographic predecessor chain.
- Never execute the protected action; this gate authorizes and records reasoning only.

## Exclusions

This slice does not authenticate a real person, verify signatures, persist identity or audit state durably, execute tools or protected actions, publish events, stream model output, route fallbacks, access secrets, deploy, spend, or perform external effects.

## Verification

Root formatting, zero-warning linting, strict type-checking, unit and integration tests, build, and diagnostics must pass. Tests must cover R0 completion, R1 and R3 approval stops, R4 denial, exact R3 approval success and consumption, altered approval denial, model/provider failure, malformed output, timeout, correlation, and audit-chain integrity. Live evidence must connect the deterministic integrated-gate result with the approved local `qwen3:8b` structured-output proof and verify zero active model resources.

## Rollback and Wave Completion Gate

Revert the bounded merge commit before Wave 4 behavior. Wave 3 may close only after the integrated gate is verified, public-safe evidence is preserved, the repository is clean, remote equality is proven, the pull request is conflict-free, and the Founder approves merge.
