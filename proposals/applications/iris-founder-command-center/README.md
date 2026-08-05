# IRIS Founder Command Center Proposal Package

**State:** Exact specification and six-capability selection approved; non-executable bundle generated and locally verified

**Execution authority:** None

This package defines the first proposed real Layer 4 IRIS application without creating its repository or implementation.

## Contents

- `application-specification.json` - strict Wave 12 application specification
- `capability-selection-proposal.json` - six proposed capabilities bound to the exact specification digest
- `approved-capability-selection.json` - Founder-approved record of the exact six-capability selection
- `application-factory-bundle.json` - canonical non-executable Application Factory output
- `infrastructure-blueprint.json` - pending local-only, zero-cost, non-public development blueprint
- `architecture-and-security.md` - ownership boundaries, technology pins, threats, controls, rollback, and cleanup
- `interface-design.md` - application shell, views, approval review, interaction rules, and visual direction
- `bounded-implementation-proposal.md` - future repository, file plan, sequence, acceptance criteria, and authority exclusions
- `verification-report.md` - deterministic local validation results

## Exact Review Target

Application specification digest:

`sha256:244748483dc3b7e79157adb828c6db881f561d379987709209ac0ece97c0dd8e`

Generated bundle digest:

`sha256:f039bbb31bb36d2e0f448385b676e14ba5f3f98e12c634b4a7c64ce20a0a87ea`

The approved selection authorizes only this bundle generation. The bundle remains in `proposal` state with `executionAuthorized: false`. Its requested private repository is explicitly `created: false`, and core repository mutation is forbidden. Repository creation, dependency installation, implementation, staging, committing, pushing, credentials, deployment, public exposure, spending, and provider resources remain separate actions.
