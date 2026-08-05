# ADR-006: Application Factory and Continuous Evolution Boundaries

**Status:** Canonical; Wave 12 implementation and decision gate verified

**Date:** 2026-08-05

**Owners:** Founder and IRIS Core

## Decision

IRIS Core owns application specifications, exact capability approvals, proposal generation, verification plans, infrastructure blueprints, rollback/cleanup plans, maintenance plans, research intake, benchmarks, and evolution proposals. Layer 4 product code and state always occupy separate private repositories.

The Application Factory emits an exact proposal with `executionAuthorized: false`. Repository creation, credential use, dependency installation, deployment, merge, publication, and spending remain distinct protected actions. The Continuous Evolution engine may compare evidence and recommend architecture changes, upgrades, deprecations, native replacements, roadmap changes, or self-improvements, but every result remains pending Founder approval.

## Consequences

IRIS can repeatedly design and test applications without absorbing products into Core or silently acting on providers. More approval steps are required, but authority, rollback, licensing, cost, and cleanup stay explicit. Generated formats and providers remain replaceable.

## Verification

Tests prove exact approval binding, Layer 4 separation, private repository proposals, blueprint validity, file-digest equality, disposable local materialization and removal, deployment/rollback/cleanup/zero plans, maintenance/monitoring, evidence-backed evolution categories, and refusal to propose without evidence.

## Rollback

Reject the proposal, remove its disposable workspace, preserve IRIS Core history, revoke any separately issued provider approval, terminate scoped resources, and verify provider zero. No proposal is itself an execution record.
