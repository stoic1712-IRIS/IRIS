# ADR-001: Coordination Bus Progression

**Status:** Canonical; Wave 4 implementation and decision gate verified

**Date:** 2026-08-04

**Owners:** Founder and IRIS Core

**Related wave/capability:** Waves 2 and 4; Coordination Bus

## Context

IRIS requires governed event publication, authorization, replay, acknowledgements, retry, dead-letter handling, idempotency, audit correlation, and removable providers. The initial implementation must remain understandable and must not introduce distributed infrastructure before process boundaries require it.

## Decision Drivers

IRIS-owned contracts, deterministic tests, durable evidence, local operation, least privilege, permissive licensing, replay, provider removal, and low operational complexity.

## Options Considered

- IRIS-native in-process TypeScript bus: smallest first implementation, but not cross-process durable by itself.
- PostgreSQL 18.4 transactional outbox: durable and transactionally coupled to canonical records; polling adds latency and implementation work.
- NATS Server 2.14.4 with JetStream: Apache-2.0, durable streams, replay, authorization, acknowledgements, deduplication, and clustering; adds an external service.
- Redis 8.10.0 Streams: functional consumer groups and replay, but adds overlapping infrastructure, persistence caveats, unauthenticated defaults, and tri-license review.

## Decision

Implement the IRIS-owned event contract and in-process bus first. Use PostgreSQL outbox records when durable state is introduced. Introduce NATS JetStream only when verified cross-process delivery requirements justify a broker. Defer Redis Streams.

No provider may define canonical event schemas, authorization, audit meaning, or idempotency rules. NATS acceptance requires pinned images, authentication, subject-level authorization, bounded retention, encrypted transport when crossing a trusted local boundary, replay tests, duplicate-delivery tests, and provider-disablement proof.

## Consequences

The initial system remains small while retaining a tested migration path to NATS. PostgreSQL may temporarily serve both canonical persistence and durable outbox roles. NATS operation and backup become later responsibilities only when needed.

## Verification

Test duplicate delivery, unauthorized subscription, sensitive-field redaction, retry, dead-letter preservation, deterministic replay, outbox recovery, and equivalent behavior with the NATS adapter disabled. Evidence begins at `evidence/wave-2/disposable-candidate-evaluation-2026-08-04.md`.

## Rollback and Removal

Disable the provider adapter, drain and export required events, verify PostgreSQL/outbox state, remove NATS containers and volumes, and prove the in-process contract tests still pass.

## Approval

Founder approval granted in the Founder conversation on 2026-08-04: "I approve ADR-001 through ADR-004 as the architectural direction for coordination, canonical memory, model runtime adapters, and bootstrap orchestration." The decision and its Wave 4 implementation are canonical. This approval does not authorize provider installation into the canonical stack.

## Supersession

None.
