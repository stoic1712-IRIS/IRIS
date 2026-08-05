# IRIS Founder Command Center Bounded Implementation Proposal

**State:** Pending Founder approval

**Execution authorized:** No

**Specification digest:** `sha256:244748483dc3b7e79157adb828c6db881f561d379987709209ac0ece97c0dd8e`

## Requested Future Repository

- Owner: `stoic1712-IRIS`
- Name: `iris-founder-command-center`
- Visibility: private
- Created: no
- IRIS Core mutation allowed: no

## Release-One Boundary

Release one is a local synthetic-data interface proof. It contains no live IRIS action adapter, credentials, persistence, cloud integration, deployment, public listener, paid resource, analytics, telemetry, or production data.

## Planned Files

| Path                       | Purpose                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `package.json`             | Exact private tool and dependency boundary                                             |
| `src/contracts.ts`         | Strict Layer 4 view-model schemas                                                      |
| `src/fixtures.ts`          | Deterministic fictional missions, approvals, workers, evidence, blueprints, and health |
| `src/App.tsx`              | Application shell and screen routing                                                   |
| `src/views/Overview.tsx`   | Decision queue, mission sequence, worker lifecycle, and health summary                 |
| `src/views/Approvals.tsx`  | Exact non-authoritative approval review interface                                      |
| `src/views/Missions.tsx`   | Mission, dependency, blocker, and evidence views                                       |
| `src/views/Workers.tsx`    | Worker permission and lifecycle inspection                                             |
| `src/views/Evidence.tsx`   | Redacted citation and audit-integrity inspection                                       |
| `src/views/Blueprints.tsx` | Read-only canonical blueprint viewer boundary                                          |
| `src/views/Health.tsx`     | Allowlisted local health summaries                                                     |
| `src/styles.css`           | Accessible responsive product design tokens and layout                                 |
| `tests/`                   | Contract, fail-closed, redaction, accessibility, and screen acceptance tests           |
| `Dockerfile`               | Future digest-pinned non-root disposable build; not executed in release-one drafting   |
| `README.md`                | Authority boundaries, local operation, verification, rollback, and removal             |

## Implementation Sequence

1. Create the separate private repository after explicit authorization.
2. Scaffold the exact pinned toolchain without adding unreviewed dependencies.
3. Implement strict view-model schemas and deterministic synthetic fixtures.
4. Implement the accessible application shell and seven bounded views.
5. Prove that UI state has zero authority and protected actions fail closed.
6. Run formatting, linting, type checks, tests, production build, dependency audit, secret scan, and accessibility checks.
7. Run the build in a disposable local environment bound only to loopback.
8. Verify rollback, cleanup, closed host port, and zero matching provider resources.
9. Present the local proof to the Founder. Do not deploy or connect live IRIS services.

## Acceptance Criteria

- Every screen renders deterministic synthetic data and its evidence source.
- Altered, stale, missing, contradictory, or unauthorized records fail closed.
- No browser state can change approval, audit, canonical memory, worker, repository, or provider authority.
- Secret-like values and restricted fields are rejected or redacted before rendering.
- Keyboard and screen-reader navigation reach every view and control.
- The production build contains no network destination, telemetry, credential, or public exposure.
- Disposable startup, shutdown, rollback, cleanup, port-closure, and provider-zero checks pass.
- The Founder reviews the local result before any live adapter, repository publication, or deployment proposal.

## Authorization Still Required

This proposal does not authorize repository creation, dependency installation, implementation, staging, committing, pushing, live IRIS connectivity, credential use, deployment, public exposure, spending, or provider-resource creation.
