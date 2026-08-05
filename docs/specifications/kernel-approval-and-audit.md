# Kernel Approval and Audit Specification

**Status:** Draft implementation specification

**Version:** 0.1.0

**Wave:** 3 - Shared Contracts and IRIS Kernel

## Purpose and Scope

This slice evaluates typed protected approvals against authenticated execution context, enforces approval lifecycle transitions, constructs deterministic audit events, and maintains an in-memory append-only cryptographic audit chain.

## Requirements

- Deny approvals that are not issued, are expired, were previously consumed, or claim R4 authority.
- Require exact matches for authenticated approver identity, action type, payload digest, target, executor, and tool.
- Consume only an issued approval and preserve the consumption timestamp.
- Validate every audit event through the canonical shared contract.
- Compute deterministic SHA-256 event digests.
- Require every event after the first to reference the exact preceding digest.
- Reject duplicate event identifiers and broken predecessor chains.
- Return defensive copies so callers cannot mutate stored history.

## Exclusions

This slice does not implement identity authentication, signature verification, trusted time, durable persistence, network transport, provider calls, filesystem writes, deployment, or external actions. The authenticated identity and deterministic timestamps are explicit inputs supplied by later governed boundaries.

## Security and Failure Behavior

Evaluation is fail-closed. Any mismatch produces a denial with explicit reasons. Invalid schemas, invalid lifecycle transitions, duplicate events, and audit-chain mismatches throw before state changes. No approval can authorize R4 behavior.

## Verification

Root formatting, zero-warning linting, strict type-checking, unit tests, build, and diagnostics must pass. Tests cover exact-match approval, mismatch denial, single consumption, revoked-approval rejection, valid audit chaining, duplicate protection, and incorrect predecessor rejection.

## Rollback and Completion Gate

Revert the bounded merge commit before dependent Kernel or Coordination behavior. Completion requires a clean committed tree, sensitivity review, deterministic verification, remote equality, conflict-free pull-request review, and Founder-approved merge.
