# Testing and Verification Standards

**Status:** Canonical

**Version:** 1.0.0

## Test Layers

- Unit tests verify pure logic and boundary cases.
- Contract tests verify schemas, adapters, events, authorization, and provider replacement.
- Integration tests verify bounded component collaboration with disposable dependencies.
- Acceptance tests prove the capability gate in a representative environment.
- Security tests verify denial, redaction, path, secret, network, and permission boundaries.
- Recovery tests verify failure preservation, rollback, replay, cleanup, and reapproval.

## Requirements

Tests must be deterministic where practical, isolated, repeatable, and explicit about fixtures. A test must fail for the intended defect and must not depend silently on developer state, credentials, network, time, or order.

Every change must run the narrowest relevant tests plus broader checks proportionate to impact. Skipped, flaky, or unavailable tests are limitations, not passes.

## Independent Verification

Material producers do not independently approve their own work. Verification may use deterministic tooling, a separately scoped verifier, or Founder review. The verifier must receive the objective, constraints, expected evidence, and changed scope without inheriting unnecessary write authority.

## Baseline Commands

The future monorepo must expose stable root commands for build, test, lint, format checking, type checking, and diagnostics. Exact commands and tool pins will be established only after dependency review.

## Evidence

Preserve commands, versions, environment, results, failures, repairs, duration when useful, and output location. Completion requires no unresolved blocker against the applicable gate.

## Founder Decision

- [x] Approved as canonical standards
- [ ] Approved with amendments
- [ ] Rejected for revision
