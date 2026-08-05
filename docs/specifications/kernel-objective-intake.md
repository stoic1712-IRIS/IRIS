# Kernel Objective Intake Specification

**Status:** Draft implementation specification

**Version:** 0.1.0

**Wave:** 3 - Shared Contracts and IRIS Kernel

## Purpose and Scope

This slice validates objective intake and deterministically assigns the minimum authorization requirement. It covers read-only work, local changes, protected actions, and constitutionally prohibited requests.

## Requirements

- Reject undeclared input fields and malformed canonical identifiers.
- Preserve read-only objectives as R0 with existing read authority.
- Classify local workspace changes as R1 requiring explicit task approval.
- Classify protected actions or any external effect, destructive behavior, secret use, or cost as R3 requiring typed protected approval.
- Classify prohibited objectives as R4 and deny them.
- Return explicit reasons with every classification.

## Exclusions

This slice does not authenticate approvals, execute actions, persist state, publish events, call models, use providers, access secrets, or perform network or filesystem effects.

## Verification

Root formatting, linting, strict type-checking, unit tests, build, and diagnostics must pass. Tests prove R0 preservation, R3 escalation, R4 denial, and unknown-field rejection.

## Limitations

Classification relies on validated declared objective attributes. Trusted identity, policy lookup, approval consumption, audit persistence, and adversarial semantic analysis remain later Kernel responsibilities.

## Rollback and Completion Gate

Revert the bounded merge commit before dependent Kernel behavior. Completion requires deterministic tests, a clean committed tree, public-sensitivity review, remote equality, and Founder-approved merge.
