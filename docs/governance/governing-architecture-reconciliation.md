# Governing Architecture Reconciliation

**Status:** Canonical

**Version:** 1.0.0

**Prepared:** 2026-08-04

## Decision

The Canonical Development Roadmap controls implementation sequence. The Governing Architecture controls enduring component ownership and layer boundaries. The Constitution and Worker Reasoning Framework control authority, identity, permissions, and verification.

Where sequence language in the Governing Architecture conflicts with the Roadmap, the Roadmap prevails unless a Founder-approved amendment states otherwise.

## Reconciled Architecture

| Layer | Permanent responsibility | Replaceability rule |
| --- | --- | --- |
| 0 - Environment | Hardware, operating systems, storage, drivers, networking, physical controls | Components may change without redefining IRIS |
| 1 - Model runtimes | Serve local or approved models through provider interfaces | No runtime owns identity, memory, governance, or approval |
| 2 - Execution runtimes | Perform bounded tools, files, browser, integration, job, and scheduling work | Every runtime must be removable behind IRIS-owned contracts |
| 3 - IRIS Core | Identity, memory, planning, governance, approvals, audit, coordination, skills, interfaces | Permanent sovereign control plane |
| 4 - Applications | Independent products built and maintained by IRIS | Must remain separate from IRIS Core |

## OpenClaw Sequence Resolution

The Governing Architecture originally placed an OpenClaw baseline and private fork immediately after workstation verification. The Roadmap later established a more governed sequence:

1. Wave 1 completes governance and repository protections.
2. Wave 2 evaluates exact external candidates, identities, versions, licenses, security, dependencies, and removal paths.
3. Wave 3 establishes IRIS-owned shared contracts and Kernel boundaries.
4. Wave 4 establishes the Coordination Bus.
5. Wave 5 may introduce a bootstrap orchestration adapter only if evaluation evidence supports adoption.

Therefore, no OpenClaw installation, fork, modification, branding, or integration is authorized during Wave 1. Any future use must remain local or otherwise explicitly approved, pinned, licensed, security-reviewed, adapter-bounded, auditable, and removable.

## Ownership Rules

IRIS Core permanently owns identity, canonical memory, planning, governance, approvals, audit, coordination contracts, skill governance, and the Founder interface. Execution runtimes may perform authorized work but may not own those functions. Models supply reasoning but possess no standing authority. Layer 4 applications consume governed capabilities without becoming part of the Core.

## Provider Boundaries

Every provider integration must define:

- an IRIS-owned interface;
- supported capabilities and explicit exclusions;
- configuration and secret boundaries;
- health, timeout, retry, and failure behavior;
- provenance and audit events;
- data and network exposure;
- replacement and export procedure; and
- disablement and removal tests.

Provider-specific data must not become the only copy of canonical state.

## Canonical Memory Boundary

Workers and providers receive task-scoped context. They may propose durable memory updates with provenance and conflict information, but only the governed memory process may activate canonical state.

## Layer 4 Boundary

Domain applications, including agency, healthcare, business, and client systems, remain independent repositories and products. Research, coding, planning, business analysis, and productivity capabilities that strengthen IRIS itself remain IRIS Core capabilities.

## Reconciliation Result

No contradiction remains in permanent ownership or layer structure. The OpenClaw implementation-sequence conflict is resolved in favor of the Roadmap. The original read-only source remains unchanged; this repository record is the proposed canonical reconciliation.

## Founder Decision

- [x] Approved as canonical reconciliation
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:**

**Decision date:**

**Approved version or commit:**

**Notes:**
