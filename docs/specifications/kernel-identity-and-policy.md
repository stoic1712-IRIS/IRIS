# Kernel Identity and Policy Evaluation Specification

**Status:** Canonical and implemented; completion gate verified

**Version:** 0.1.0

**Wave:** 3 - Shared Contracts and IRIS Kernel

## Purpose and Scope

This slice establishes provider-independent cognitive identity records, authenticated actor context, Founder-authority boundaries, reasoning profiles, a fail-closed risk policy registry, permission evaluation, contradiction detection, and exact proposal-digest verification.

## Requirements

- Represent IRIS cognitive identity using the fields required by the canonical Worker Reasoning Framework.
- Prevent workers, models, tools, and IRIS Core from holding Founder-only approval authority.
- Require authentication before an actor can hold any authority scope.
- Recognize Founder authority only when the authenticated identity exactly matches the configured Founder identity and required scope.
- Define one deterministic policy rule for each R0-R4 risk class.
- Allow R0 only within authenticated read authority, require approval for R1-R3, and deny R4.
- Deny contradictory risk and authorization claims.
- Require R3 evaluations to name the exact protected action.
- Require R2 and R3 proposal payloads to match their exact SHA-256 digest.
- Return defensive copies from the policy registry.

## Exclusions

This slice does not authenticate a real person, verify signatures, issue or consume approvals, execute actions, persist identity or policy state, access secrets, call models or providers, publish events, or perform network or filesystem effects. Authentication context and canonical identity activation remain inputs to later governed boundaries.

## Security and Failure Behavior

Evaluation is fail-closed. Unknown or duplicate policies, missing actor scope, unauthenticated authority, contradictory classifications, altered proposal payloads, R3 requests without an exact protected action, and all R4 requests are denied or rejected before any state change.

## Verification

Root formatting, zero-warning linting, strict type-checking, unit tests, build, and diagnostics must pass. Tests cover exclusive Founder authority, unauthenticated rejection, R0 read permission, R1 approval requirements, R3 action and digest binding, contradiction denial, R4 denial, duplicate policy rejection, and defensive policy copies.

## Rollback and Completion Gate

Revert the bounded merge commit before dependent Kernel or model-gateway behavior. Completion requires a clean committed tree, sensitivity review, deterministic verification, remote equality, conflict-free pull-request review, and Founder-approved merge.
