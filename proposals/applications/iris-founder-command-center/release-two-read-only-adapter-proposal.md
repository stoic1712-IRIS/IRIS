# IRIS Founder Command Center Release Two Read-Only Adapter Proposal

**State:** Drafted; non-executable; pending Founder approval after Release One visual acceptance

**Release One revision:** `270e39ad68ec60b1b803f56133b92970cb1237b0`

## Objective

Replace selected synthetic display inputs with a strict read-only adapter for allowlisted IRIS status data without adding any mutation, approval consumption, repository write, provider action, credential handling in the browser, deployment, or public listener.

## Proposed Read Surface

1. Canonical IRIS revision and repository equality status.
2. Mission identifiers, sequence, blockers, progress, and evidence citations.
3. Proposal identifiers, exact digests, risk, expiry, and approval state for display only.
4. Temporary-worker identity, bounded permissions, lifecycle, termination, and cleanup state.
5. Redacted audit and evidence summaries with integrity and freshness state.
6. Canonical blueprint validation, cost ceiling, exposure policy, and provenance.
7. Allowlisted component health and provider-zero summaries.

## Explicit Exclusions

- No objective submission to IRIS Core.
- No approval statement submission or consumption.
- No Git, repository, checkpoint, issue, or pull-request writes.
- No worker creation, model invocation, provider mutation, deployment, or spending.
- No secrets, tokens, environment values, prompts, chain-of-thought, unrestricted logs, or hidden worker context.
- No database, browser persistence, analytics, telemetry, cloud service, or public exposure.

## Adapter Contract

The adapter must expose versioned, strict, allowlisted response schemas. Unknown fields are rejected. Missing, stale, contradictory, unsigned, or unavailable identity, policy, evidence, repository, model, or provider state fails closed and is visibly labeled. The browser receives display models only and cannot infer authority from session or UI state.

The transport must bind to loopback and use an authenticated Core-issued actor context when that contract exists. Authentication design and any credential material require a later exact review; they are not authorized by this proposal.

## Verification Plan

- Contract fixtures for valid, missing, stale, contradictory, oversized, and undeclared-field responses.
- Recursive redaction and secret-like-value rejection.
- Proof that every network method is read-only and allowlisted.
- Proof that protected controls remain disabled and no mutation endpoint is bundled.
- Format, lint, typecheck, tests, production build, dependency audit, secret scan, accessibility review, and bundle destination scan.
- Disposable loopback startup, shutdown, port closure, cleanup, and provider-zero verification.

## Rollback

The adapter must be replaceable by the Release One synthetic fixture source without changing view contracts. Rollback uses a history-preserving revert in the private application repository and restores the exact Release One revision behavior.

## Approval Boundary

This document authorizes nothing. Implementing or connecting the adapter, adding authentication, installing new dependencies, staging, committing, pushing, deploying, using credentials, exposing a listener, spending, or creating provider resources each require separately bounded authority.
