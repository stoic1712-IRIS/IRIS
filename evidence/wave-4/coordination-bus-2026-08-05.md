# Wave 4 Coordination Bus Evidence

**Date:** 2026-08-05
**Branch:** `iris/wave-4-coordination-bus`
**Baseline:** `15aeeab5b787b9bb6e3b14e4b62c48f0afecb0dc`
**Status:** Decision gate passed and evidence canonical

## Verified capability

The IRIS-owned in-process Coordination Bus now accepts strictly validated, versioned events and provides:

- separate publication, subscription, and delivery authorization boundaries;
- correlation and provenance preservation;
- deterministic idempotency and duplicate suppression;
- subscriber acknowledgements;
- bounded retry from one to ten attempts;
- dead-letter preservation after exhaustion;
- deterministic replay through current authorization;
- explicit JSON-pointer sensitive-field redaction;
- cloned deliveries protecting the canonical event log from handler mutation; and
- a deterministic SHA-256-linked operational audit chain containing no payloads.

## Deterministic verification

The Wave 4 suite proves:

1. Authorized delivery succeeds and redacts both top-level and nested sensitive fields.
2. Subscriber mutation cannot alter the canonical event record.
3. Unauthorized subscriptions are rejected before registration and audited.
4. Unauthorized publication stores and delivers nothing.
5. A repeated idempotency key is suppressed even when supplied with a different event identifier.
6. Failed delivery retries exactly to the configured bound and preserves a dead letter.
7. Replay reads the canonical event log and re-evaluates current delivery authorization.
8. The operational audit digest chain verifies after delivery and replay.

Repository-wide formatting, lint, type checking, build, diagnostics, and all tests must pass again after this evidence is added.

## Provider and resource state

This slice uses no message broker, container, network listener, cloud service, paid resource, credential, or secret. Provider-disablement equivalence is structural: no provider adapter is installed or required. NATS JetStream remains deferred until a verified cross-process requirement exists.

PostgreSQL transactional outbox recovery is not claimed. The canonical ADR introduces that mechanism only when durable state exists. This in-process slice instead proves deterministic replay from its IRIS-owned process-local event log; durable restart recovery remains a later persistence-adapter gate.

## Repair record

The first test run exposed a Wave 1 baseline assertion that intentionally required Coordination to remain empty. Because Wave 4 activates the previously reserved boundary, that assertion was replaced with an exact allowlist for `index.ts` and `in-process-bus.ts`. Initial lint and build findings concerning deprecated validation, an unused handler binding, numeric interpolation, a void-expression assertion, and missing Node type scope were corrected before final verification.

## Rollback

Before dependent Wave 5 behavior exists, revert the future bounded Wave 4 merge commit. No external data, broker state, container, volume, credential, or paid resource requires cleanup.

## Completion boundary

This evidence does not by itself complete Phase 0. Wave 4 was reviewed and merged through PR #11 at merge revision `d6dd53e`, which is an ancestor of canonical `main`.
