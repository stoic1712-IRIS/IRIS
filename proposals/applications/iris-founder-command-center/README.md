# IRIS Founder Command Center Proposal Package

**Proposal state:** Exact specification and six-capability selection approved; immutable non-executable bundle retained

**Current realization state:** Release One implemented and verified in a separate private repository; pending final Founder visual acceptance

**Execution authority:** None

This package preserves the proposal that authorized creation of the first real Layer 4 IRIS application. The private repository and Release One implementation now exist. Current realization evidence is recorded in `evidence/applications/iris-founder-command-center-release-one-2026-08-05.md`.

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

The approved bundle is an immutable proposal snapshot and therefore remains in `proposal` state with `executionAuthorized: false` and historical `created: false`. It must not be rewritten to describe later execution. The separately authorized realization is bound to private repository `stoic1712-IRIS/iris-founder-command-center` at commit `270e39ad68ec60b1b803f56133b92970cb1237b0`.

Release One remains synthetic, local-only, non-authoritative, and undeployed. Live IRIS connectivity, approval submission, canonical writes, provider actions, public exposure, spending, and deployment require separate exact approval.
