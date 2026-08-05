# Repository Blueprint and Map

**Status:** Canonical

**Version:** 1.0.0

## Blueprint

The repository is a public-authority target with governed branches, IRIS-owned contracts, replaceable providers, reproducible tooling, and evidence-preserving workflows. Public visibility is the Founder-approved current operating state recorded in `docs/governance/repository-visibility-decision.md`; it is not a current Wave 1 blocker. All repository history and provider-visible activity must be treated as public disclosure.

## Current Map

| Path | Current contents | Authority |
| --- | --- | --- |
| `README.md` | Project identity summary | Informational entry point |
| `docs/governance/` | Constitution, reasoning framework, policies, standards, inventory | Founder-approved documents become canonical through commits |
| `docs/architecture/` | Reconciliations, repository design, dependency graph, ADRs | Architecture authority after approval |
| `docs/registries/` | Dependencies, technologies, platforms, later capabilities | Evidence-backed canonical records after approval |
| `evidence/wave-0/` | Workstation certification and output | Preserved completion evidence |
| `scripts/diagnostics/` | Reproducible workstation diagnostic | Governed operational tooling |

## Planned Baseline After Governance Gate

| Path | Intended role |
| --- | --- |
| `apps/` | Deployable IRIS processes and interfaces |
| `packages/contracts/` | Shared identifiers, provenance, risk, approval, audit, error, and evidence schemas |
| `packages/kernel/` | Identity, objective intake, governance, audit, registry, and provider boundaries |
| `packages/coordination/` | Event envelopes and in-process/durable coordination adapters |
| `packages/model-gateway/` | Ollama, LM Studio, and compatible provider adapters |
| `packages/orchestration/` | IRIS-owned execution contracts and removable bootstrap-runtime adapters |
| `packages/memory/` | Governed canonical memory, knowledge retrieval, and repository intelligence |
| `packages/planning/` | Mission decomposition, roadmap state, dependency-aware prioritization, and Core/Layer 4 classification |
| `packages/workers/` | Governed temporary-worker specifications, bounded context, permission calculation, model assignment, lifecycle, revocation, and cleanup |
| `packages/capabilities/` | Candidate intake, provenance/license/security review, capability mapping, pattern extraction, decisions, and original worker proposals |
| `tests/` | Cross-package acceptance and architecture tests |

The planned structure is not authorization to scaffold. It activates only after governing documents, the approved visibility decision, provider-enforced protections, and dependency decisions satisfy Wave 1 prerequisites.

## Ownership

IRIS-owned packages define permanent contracts. External code must not be copied into Core without an approved adoption record. Layer 4 applications belong in separate repositories.

## Founder Decision

- [x] Approved as canonical blueprint and map
- [ ] Approved with amendments
- [ ] Rejected for revision
