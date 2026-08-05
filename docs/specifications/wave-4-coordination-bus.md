# Wave 4 Coordination Bus Specification

**Status:** Canonical and implemented; Wave 4 decision gate passed

## Purpose

Establish the first IRIS-owned coordination nervous system without introducing a distributed broker. The bus transports governed, versioned events between authorized in-process components while preserving correlation, provenance, idempotency, acknowledgements, retries, dead letters, deterministic replay, sensitive-field redaction, and tamper-evident operational evidence.

## Authority and safety boundaries

- Events communicate facts and requests; they do not grant authority.
- Publication, subscription, and delivery each pass an injected authorization boundary.
- Explicit sensitive paths are redacted from every subscriber delivery in this slice.
- Duplicate idempotency keys never produce a second delivery.
- Failed delivery is bounded to 1–10 attempts and then preserved as a dead letter.
- Replay uses the IRIS-owned event log and never bypasses delivery authorization.
- Audit entries contain summaries and identifiers, never event payloads.
- Handlers cannot mutate the canonical stored event because every delivery receives a clone.

## Deliberate exclusions

No NATS, Redis, PostgreSQL, network listener, cross-process transport, protected-action execution, secret access, deployment, paid resource, or provider-defined schema is introduced. PostgreSQL transactional outbox persistence and NATS JetStream remain later adapter work triggered by durable or cross-process requirements.

## Completion gate

Wave 4 requires deterministic proof of authorized delivery, denied subscription, duplicate suppression, redaction, retry, dead-letter preservation, replay, immutable event storage, and an intact audit chain. Repository-wide format, lint, type, test, build, and diagnostic checks must pass before Founder review.
