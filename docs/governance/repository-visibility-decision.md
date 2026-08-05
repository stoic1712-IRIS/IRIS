# Repository Visibility Decision

**Status:** Founder-approved operating decision

**Version:** 1.0.0

**Decision date:** 2026-08-04

**Repository:** `stoic1712-IRIS/IRIS`

## Decision

The canonical STOIC-IRIS repository will operate as a public GitHub repository during current development. Public visibility is an intentional Founder-approved disclosure decision, not a temporary error, unresolved privacy blocker, or condition that must be raised again during ordinary Wave 1 work.

The decision was made after verifying that GitHub Free enforces the configured `Protect main` ruleset for a public repository but does not enforce it when the same repository is private. Enforced default-branch governance was selected over unenforced private visibility for the current development stage.

## Current Provider State

- Repository visibility: public.
- Default branch: `main`.
- Ruleset: `Protect main`.
- Ruleset state: active.
- Enforced rules: require a pull request before merging, restrict deletion, and block force-pushes.
- Repository history must be presumed permanently copied once public.

## Operating Rules

1. Public visibility must not be reported as a current Wave 1 blocker while this decision remains active.
2. Every commit, push, pull request, issue, action log, release, and other repository artifact must be treated as public disclosure.
3. Secrets, credentials, sensitive personal data, recovery authority, private operational evidence, and unredacted security material must never be committed or published.
4. Public exposure does not waive typed approval requirements for staging, committing, pushing, pull-request creation, merging, releases, or later visibility changes.
5. Any proposal to make the repository private again must include proof that required branch protections will remain provider-enforced, or an explicit Founder-approved exception.

## Phase 0 Graduation Boundary

This operating decision does not amend the permanent Phase 0 graduation criterion requiring IRIS to create and push a private checkpoint during the genuine Founder-operated multi-file self-upgrade. That checkpoint may use a separate private target or a later visibility and plan decision. It is a future graduation requirement, not a present Wave 1 repository-visibility blocker.

## Reconsideration Triggers

Reconsider this decision only when the Founder requests it, repository contents become unsuitable for public disclosure, a paid GitHub plan or another provider can enforce protections privately, the Phase 0 private-checkpoint workflow is being designed, or a material security/legal requirement changes.

## Founder Authorization

The Founder authorized public visibility and directed that the decision be recorded in project documentation so it is not repeatedly raised as an unresolved current blocker.
