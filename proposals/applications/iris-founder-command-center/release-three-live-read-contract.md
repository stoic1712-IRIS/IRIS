# IRIS Founder Command Center Proposed Live-Read Contract

**Version:** `iris.stoic/read-model/v1`

**State:** Proposed; non-executable; no connectivity or credentials authorized

## Ownership

IRIS Core owns identity, policy, canonical state, approval meaning, audit integrity, missions, workers, blueprints, repository truth, and provider truth. The Layer 4 Command Center may receive allowlisted display models only. Browser or adapter state never establishes authority.

## Transport

- Future Core endpoint: loopback only, `127.0.0.1`, exact path `GET /v1/read-model`.
- No wildcard host, LAN binding, public listener, redirect, WebSocket, event stream, upload, or mutation route.
- `GET` is the sole method. `POST`, `PUT`, `PATCH`, `DELETE`, and provider-specific methods fail closed.
- Response media type: `application/json`.
- Maximum response: 256 KiB.
- Request timeout: 2 seconds; no automatic retry for authentication, integrity, or contract failures.

The first proof uses a disposable mock service on `127.0.0.1:4180`. It contains deterministic fixtures only and does not connect to IRIS Core.

## Future Authenticated Actor Context

Actual connectivity requires a Core-issued, short-lived, audience-bound, read-only actor token delivered outside browser persistence. The token must identify the Founder actor, exact audience `iris-founder-command-center`, read scope `read-model:v1`, issue and expiry times, unique identifier, and Core issuer. The adapter must validate issuer, audience, scope, expiry, and one active local session before accepting data.

The browser must never store, display, log, export, or persist the token. Authentication design is recorded here for later review; no token issuance, credential storage, or authenticated connection is authorized by the mock proof.

## Response Envelope

The response is a strict object containing only:

- `apiVersion`: exact `iris.stoic/read-model/v1`;
- `generatedAt` and `expiresAt`: UTC timestamps;
- `actor`: allowlisted actor identifier and authenticated-state summary;
- `canonicalRevision`: exact IRIS revision;
- `integrity`: algorithm, payload digest, and Core attestation state;
- `payload`: strict display models for missions, proposals, workers, evidence, blueprints, and health.

Unknown fields are rejected. Every record carries source revision, evidence citation, integrity state, and freshness. Missing, stale, contradictory, unauthenticated, incorrectly scoped, oversized, unsigned, or unverifiable responses render no protected data.

## Allowlisted Data

- Canonical revision and remote-equality status.
- Mission identifier, objective summary, sequence, blockers, progress, and citations.
- Proposal identifier, digest, risk, expiry, protected-action class, and display-only approval state.
- Worker identifier, mission, model label, bounded permission summary, lifecycle, termination, and cleanup state.
- Redacted audit/evidence title, citation, integrity, freshness, and correlation identifier.
- Blueprint identifier, profile, validation findings, provenance, exposure policy, and cost ceiling.
- Component availability, bounded latency/error summary, model-runtime status, repository status, and provider-zero summary.

## Forbidden Data and Behavior

Secrets, tokens, environment values, raw prompts, chain-of-thought, unrestricted logs, hidden worker context, private keys, personal data outside the allowlist, mutation commands, provider credentials, repository write authority, and approval-consumption authority are forbidden.

## Failure and Rollback

Any contract, identity, freshness, integrity, redaction, size, method, origin, or availability failure closes the adapter and renders a visible unavailable state without falling back to stale data. Rollback restores the disconnected Release Two adapter at private revision `b223f61fced170bdcb4b7ef7a76fb0c837369e46` through a history-preserving revert.

## Verification Requirements

- Valid, missing, stale, expired, oversized, undeclared, contradictory, incorrectly scoped, unauthenticated, unsigned, and secret-containing fixtures.
- Exact method/path/origin allowlist tests.
- Proof of zero mutation routes and zero browser credential persistence.
- Redaction, accessibility, format, lint, typecheck, tests, build, dependency audit, secret scan, and bundle destination scan.
- Disposable mock startup, loopback binding, shutdown, port closure, cleanup, and provider-zero evidence.
