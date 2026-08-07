# Cycle Nine Phase 0 Graduation Transport

**Status:** Founder-authorized local implementation

## Purpose

This contract is the Core-owned transport boundary between the Phase 0 graduation-readiness controller and the Founder Command Center. It corrects the missing transport discovered during independent review of Cycle Nine B. It does not execute graduation or declare Phase 0 complete.

## Routes and authentication

- `GET /v1/graduation-readiness` uses scope `phase-zero-graduation:read:v1`.
- `POST /v1/graduation-approvals` uses scope `phase-zero-graduation:approve:v1`.
- Both routes are loopback-only and bind the method, exact path, one-use request ID, timestamp, audience, scope, and `SHA-256` digest of the exact request body into the HMAC signature.
- Responses retain exact-body attestation. Requests expire after 30 seconds and replayed request IDs fail closed.

## Authority boundary

Readiness envelopes and approval schemas are exported by IRIS Core. Initial approval includes the Core approval ID and complete authentication evidence. Merge approval additionally binds the delivery commit, independently reviewed commit, and pull-request number. The transport controller delegates to an authoritative Core store and owns no process-local approval ledger.

The ordinary read-service runtime returns an authenticated `idle` envelope when no graduation is active. Approval submission remains unavailable unless a durable authoritative Core store is configured. The HTTP layer exposes no execute, activate, merge, repository-write, provider-mutation, or completion route.

## Event integrity

Core exports one canonical ordered stage list. Event hashes and links remain necessary, and the transport adds semantic stage-progression validation. A successful `completed` result must include the exact complete stage sequence; reordered or skipped success chains fail closed.

## Phase 0 boundary

This is readiness machinery only. The final permanent gate still requires deployed IRIS herself to perform the genuine Founder-approved multi-file self-upgrade while Claude and Codex remain audit-only.
