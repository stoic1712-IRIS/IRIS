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
| Worker Reasoning Framework and Cognitive Identity Engine | Original source missing; replacement version 1.0.0 Founder-approved | Roadmap says it governs identity, mission, judgment, permissions, risk, and governance | Commit the approved replacement; reconcile any recovered original through governed comparison |

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
| Finalize Governing Architecture | Source available, not reconciled | Compare every architectural principle against the approved Constitution and record contradictions |
| Finalize Worker Reasoning Framework | Founder-approved; commit pending | `docs/governance/worker-reasoning-framework-and-cognitive-identity.md`, version 1.0.0; approval granted 2026-08-04 |
| Define approval and authorization policy | Not started | Must specify action classes, typed approval, approval scope, expiry, reapproval, and denial behavior |
| Define protected paths and branch policy | Not started | Must define protected files, branch naming, review, merge, force-push, and emergency-recovery rules |
| Create private GitHub repository | Not satisfied | GitHub currently reports `stoic1712-IRIS/IRIS` visibility as public; Founder has accepted temporary public visibility, but the Wave 1 gate still requires private visibility |
| Create canonical local repository | Complete | `C:\Projects\STOIC-IRIS` with remote `origin` |
| Establish `iris/*` branch convention | Partially demonstrated | Current branch follows the convention; written policy is still required |
| Scaffold TypeScript monorepo | Not started | Prohibited until canonical rules and repository protections exist |
| Add test, lint, format, and build commands | Not started | Must accompany the empty baseline scaffold and pass before Wave 1 completion |

## Wave 1 Supporting Track

| Requirement | Status | Current evidence or next action |
| --- | --- | --- |
| Dependency attribution registry | Not started | Define schema before recording adopted dependencies |
| Architecture decision record template | Not started | Create after repository documentation conventions are approved |
| Evidence folder conventions | Provisional | `evidence/wave-0/` exists; formal naming, retention, sensitivity, and redaction rules are unresolved |
| Secrets-handling policy | Not started | Must cover local files, environment variables, logs, prompts, CI, providers, and rotation |
| Licensing policy | Not started | Constitution contains the governing principle; operational review procedure remains required |
| Security baseline | Not started | Must define local, WSL, Docker, repository, dependency, network, and model-runtime controls |
| Repository conventions | Not started | Must define layout, naming, ownership, documentation status, and generated artifacts |

## Decision-Gate Evidence

| Gate condition | Status | Blocker |
| --- | --- | --- |
| Governing documents are mutually consistent | Not demonstrated | Constitution and replacement Worker Reasoning Framework are approved, but the Governing Architecture sequence conflict remains unresolved |
| Repository is private | Failed | Repository is currently public |
| Default-branch protections are confirmed | Unverified | No provider-authoritative protection evidence has been captured |
| Local and remote commit equality confirmed | Passed for Wave 0 branch checkpoint | Must be repeated for the Wave 1 checkpoint |
| Empty baseline build and tests pass | Not started | Governance and protections must be completed first |

Wave 1 is not complete. IRIS Kernel implementation must not begin while these blockers remain.

## Contradictions and Open Decisions

### Repository visibility

The Roadmap requires one private authoritative repository. GitHub currently reports the repository as public. The Founder has accepted temporary public visibility during development, but this does not amend or satisfy the canonical Wave 1 gate. Resolution requires either making the repository private or approving a versioned Roadmap amendment with documented security and exposure consequences.

### Missing original Worker Reasoning Framework

The Roadmap treats the Worker Reasoning Framework and Cognitive Identity Engine as a source foundation, but the original is absent from the connected project materials. The Founder approved replacement version 1.0.0 on 2026-08-04. It must be committed before canonicalization exists in repository history, and any recovered original must later be compared through governed reconciliation.

### Governing Architecture sequence conflict

The Governing Architecture describes an early OpenClaw baseline and private fork, while the Canonical Development Roadmap places external technology evaluation in Wave 2 and a bootstrap orchestration adapter in Wave 5. Because the Roadmap declares itself the primary sequence authority, implementation must follow the Roadmap unless the Founder approves an amendment. The Governing Architecture should be updated or annotated during reconciliation so it cannot be misread as authority to install or fork OpenClaw now.

## Recommended Order of Work

1. Preserve the canonical Constitution and ensure all later policies conform to it.
2. Commit the Founder-approved Worker Reasoning Framework and Cognitive Identity Engine version 1.0.0.
3. Reconcile the Governing Architecture against the approved Constitution and Roadmap sequence.
4. Draft approval, authorization, protected-path, branch, secrets, licensing, security, evidence, and repository policies.
5. Confirm or change repository visibility and capture provider-authoritative branch-protection evidence.
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
