# Wave 1 Governance and Repository Inventory

**Status:** Working inventory; not a completion declaration

**Prepared:** 2026-08-04

**Branch:** `iris/governance-repository-foundation`

## Purpose

This inventory maps the current repository against the Wave 1 requirements in the STOIC-IRIS Canonical Development Roadmap. It distinguishes verified facts, drafts, missing sources, unresolved decisions, and implementation work that must not begin prematurely.

## Source Authority

| Source | Available | Current use | Gap or action |
| --- | --- | --- | --- |
| Canonical Development Roadmap | Yes | Primary sequence and decision-gate authority | Must be versioned into the repository or referenced through an approved canonical-source policy |
| Governing Architecture and Sovereignty Plan | Yes | Defines sovereign ownership and layer boundaries | Must be reconciled with the Constitution and later policies |
| Master Build Bible, Volume I | Yes | Defines permanent authoring standard and Volume I deliverables | Many required deliverables remain unwritten |
| Worker Reasoning Framework and Cognitive Identity Engine | Original source missing; replacement version 1.0.0 canonical | Roadmap says it governs identity, mission, judgment, permissions, risk, and governance | Canonical replacement recorded in commit `87e9ae1`; reconcile any recovered original through governed comparison |

The connected source documents remain read-only reference material and were not modified.

## Wave 0 Dependency

| Requirement | Status | Evidence |
| --- | --- | --- |
| Workstation measured and reproducible | Complete | `evidence/wave-0/workstation-certification.md` |
| Diagnostic automation | Complete | `scripts/diagnostics/workstation.ps1` |
| Diagnostic output preserved | Complete | `evidence/wave-0/workstation-diagnostics.txt` |
| Local and remote branch equality | Verified for commit `d58d8ac9f1a529f06e5b558c369deff69a584d07` | Local Git and remote-ref comparison performed 2026-08-04 |

## Wave 1 Required Track

| Requirement | Status | Current evidence or next action |
| --- | --- | --- |
| Finalize Constitution | Complete and canonical | `docs/governance/constitution.md`, version 1.0.0; approval granted 2026-08-04 and recorded in commit `11ee67340f922ae3f0df6414d05066ff7debe3b8` |
| Finalize Governing Architecture | Complete and canonical | `docs/governance/governing-architecture-reconciliation.md`, version 1.0.0; package commit `d0f9d50` |
| Finalize Worker Reasoning Framework | Complete and canonical | `docs/governance/worker-reasoning-framework-and-cognitive-identity.md`, version 1.0.0; approval granted 2026-08-04 and recorded in commit `87e9ae1` |
| Define approval and authorization policy | Complete and canonical | `docs/governance/approval-and-authorization-policy.md`, version 1.0.0; package commit `d0f9d50` |
| Define protected paths and branch policy | Complete and canonical | `docs/governance/protected-path-and-branch-policy.md`, version 1.0.0; package commit `d0f9d50` |
| Establish an authoritative GitHub repository with an approved exposure decision | Complete | `stoic1712-IRIS/IRIS` is public by explicit Founder decision; `docs/governance/repository-visibility-decision.md` supersedes private visibility as a current Wave 1 blocker |
| Create canonical local repository | Complete | `C:\Projects\STOIC-IRIS` with remote `origin` |
| Establish `iris/*` branch convention | Partially demonstrated | Current branch follows the convention; written policy is still required |
| Scaffold TypeScript monorepo | Not started | Prohibited until canonical rules and repository protections exist |
| Add test, lint, format, and build commands | Not started | Must accompany the empty baseline scaffold and pass before Wave 1 completion |

## Wave 1 Supporting Track

| Requirement | Status | Current evidence or next action |
| --- | --- | --- |
| Dependency attribution registry | Canonical baseline | `docs/registries/dependency-attribution-registry.md`; package commit `d0f9d50` |
| Architecture decision record template | Canonical | `docs/architecture/decisions/ADR-000-template.md`; package commit `d0f9d50` |
| Evidence folder conventions | Complete and canonical | `docs/governance/repository-documentation-and-evidence-conventions.md`, version 1.0.0; package commit `d0f9d50` |
| Secrets-handling policy | Complete and canonical | `docs/governance/security-and-secrets-policy.md`, version 1.0.0; package commit `d0f9d50` |
| Licensing policy | Complete and canonical | `docs/governance/licensing-and-dependency-policy.md`, version 1.0.0; package commit `d0f9d50` |
| Security baseline | Complete and canonical | `docs/governance/security-and-secrets-policy.md`, version 1.0.0; package commit `d0f9d50` |
| Repository conventions | Complete and canonical | `docs/governance/repository-documentation-and-evidence-conventions.md`, version 1.0.0; package commit `d0f9d50` |

## Decision-Gate Evidence

| Gate condition | Status | Blocker |
| --- | --- | --- |
| Governing documents are mutually consistent | Passed for version 1.0.0 package | Local package review found no unresolved internal contradiction; package recorded in commit `d0f9d50` |
| Repository exposure is explicitly approved | Passed | Founder approved public operation; all repository history is treated as public disclosure |
| Default-branch protections are confirmed | Passed | GitHub reported `Protect main` active for the public repository on 2026-08-04; pull requests required, deletion restricted, force-pushes blocked |
| Local and remote commit equality confirmed | Passed for merged governance checkpoint | Local `main` and `origin/main` verified equal at merge commit `a3f2fe6324ad32450dad8fd30f7e1c7e72f5069e` |
| Empty baseline build and tests pass | Not started | Governance and protections must be completed first |

Wave 1 is not complete. IRIS Kernel implementation must not begin while these blockers remain.

## Contradictions and Open Decisions

### Repository visibility

The Roadmap's private-repository preference is superseded for current Wave 1 operation by the Founder-approved `Repository Visibility Decision`, version 1.0.0. The repository is intentionally public so GitHub Free enforces the `Protect main` ruleset. Public visibility is not a current Wave 1 blocker and must not be raised as one while that decision remains active. The permanent Phase 0 graduation requirement for a private checkpoint remains separate and is not waived.

### Missing original Worker Reasoning Framework

The Roadmap treats the Worker Reasoning Framework and Cognitive Identity Engine as a source foundation, but the original is absent from the connected project materials. The Founder-approved replacement version 1.0.0 is canonical in commit `87e9ae1`. Any recovered original must later be compared through governed reconciliation rather than silently replacing the canonical record.

### Governing Architecture sequence conflict

The Governing Architecture describes an early OpenClaw baseline and private fork, while the Canonical Development Roadmap places external technology evaluation in Wave 2 and a bootstrap orchestration adapter in Wave 5. The draft reconciliation resolves sequence authority in favor of the Roadmap while preserving the Architecture's permanent ownership boundaries. Founder approval is still required before that reconciliation becomes canonical.

## Recommended Order of Work

1. Preserve the canonical Constitution and ensure all later policies conform to it.
2. Preserve the canonical Worker Reasoning Framework and ensure later authorization, worker, memory, and audit policies conform to it.
3. Preserve the canonical Wave 1 governance package and its commit provenance.
4. Preserve the approved package as the authority for later security, repository, dependency, and implementation work.
5. Preserve the approved public-visibility decision and provider-authoritative branch-protection evidence.
6. Only after the governance gate passes, create the empty TypeScript monorepo baseline and its build, test, lint, and formatting commands.

## Completion Evidence Required

Before Wave 1 may be declared complete, preserve:

- exact files and components changed;
- exact branch and revision;
- document-consistency review results;
- repository visibility and branch-protection evidence;
- tests and build commands with results;
- security and license findings;
- known limitations and unresolved risks;
- rollback and cleanup evidence;
- dependency and provider pins; and
- Founder authorization records where required.
