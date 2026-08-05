# Technology and Platform Registry

**Status:** Canonical baseline

## Platforms

| Platform | Role | Current state | Permanent IRIS boundary |
| --- | --- | --- | --- |
| Windows 11 | Founder workstation host | Operational | Replaceable environment |
| Ubuntu 26.04 LTS on WSL2 | Primary Linux development environment | Certified | Replaceable environment |
| GitHub `stoic1712-IRIS/IRIS` | Remote repository | Operational; Founder-approved public visibility; `Protect main` active | Repository provider, not governance owner; all history treated as public disclosure |
| Docker Desktop / Engine | Disposable container runtime | Certified | Replaceable execution provider |
| Ollama | Local model runtime | Certified with Qwen3 8B | Replaceable model provider |
| LM Studio | Model laboratory and fallback API | Installed; no LLM/server in certification | Replaceable model provider |

## Governed Technology Decisions

Technology becomes canonical only through an approved decision, bounded implementation, verification evidence, and repository history. Naming a candidate alone never adopts it.

## Founder-Approved Direction and Current State

The Founder approved ADR-001 through ADR-004 as architectural direction on 2026-08-04. Later waves implement those decisions behind IRIS-owned boundaries. Approval does not give an external provider governance authority.

| Domain | Proposed primary path | Alternatives or disposition | Evidence |
| --- | --- | --- | --- |
| Coordination | IRIS-native in-process contract, PostgreSQL outbox, then NATS JetStream only when cross-process delivery is required | Redis Streams deferred | `ADR-001`; Wave 2 disposable evaluation |
| Canonical memory | PostgreSQL 18.4 | Wave 6 IRIS-owned schema, governance contract, row access, audit, transactions, rollback, and backup/restore verified disposably; no persistent service deployed | `ADR-002`; Wave 6 evidence |
| Vector retrieval | pgvector 0.8.6 initially | Wave 6 exact retrieval and model-versioned rebuildable embeddings verified; vector-disabled text retrieval remains available | `ADR-002`; Wave 6 evidence |
| Model runtimes | Ollama primary; LM Studio laboratory/fallback | llama.cpp and vLLM deferred | `ADR-003` |
| Bootstrap orchestration | IRIS-owned adapter accepted; OpenClaw retained only as a removable, digest-pinned bootstrap provider | Hivemind and Gamut patterns only; Shoal blocked on identity | `ADR-004`; Wave 2 evaluation; Wave 5 bounded proof |
| Temporary workers | IRIS-owned Worker Factory and Cognitive Process Manager; digest-pinned Node container only for the Wave 8 deterministic acceptance worker | Docker supplies replaceable isolation; worker identity, permissions, context, lifecycle, revocation, evidence, and cleanup remain IRIS-owned | Wave 8 specification and evidence |
| Capability learning and worker generation | IRIS-owned Capability Learning Engine and Worker Foundry; OpenClaw contributes only an approved bounded-execution pattern | Generated workers are original proposals with zero external-runtime dependencies and cannot approve or activate themselves | Wave 9 specification and evidence |
| Sovereign development | IRIS-owned proposal, approval, disposable-worktree, execution, verification, checkpoint, rollback, cleanup, and resource-verification runtime | Machinery verified; permanent graduation remains pending a real IRIS-operated workflow with a private checkpoint and typed Founder approval | Wave 10 specification and readiness evidence |

## Registry Update Rule

Every update must include exact identity, version, source, license/security evidence, decision, owner, interfaces, limitations, replacement, removal, and approval provenance.
