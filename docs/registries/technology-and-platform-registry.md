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

## Technology Decisions Pending Wave 2

Coordination, durable workflow, memory, vector search, orchestration, model adapters, and external candidate technologies remain evaluation subjects. No candidate is adopted by being named in a source document or registry.

## Wave 2 Founder-Approved Direction

The Founder approved ADR-001 through ADR-004 as architectural direction on 2026-08-04. Canonical effect remains pending repository commit. The approval does not authorize canonical installation of an external provider.

| Domain | Proposed primary path | Alternatives or disposition | Evidence |
| --- | --- | --- | --- |
| Coordination | IRIS-native in-process contract, PostgreSQL outbox, then NATS JetStream only when cross-process delivery is required | Redis Streams deferred | `ADR-001`; Wave 2 disposable evaluation |
| Canonical memory | PostgreSQL 18.4 | PostgreSQL remains behind IRIS-owned repositories and schemas | `ADR-002` |
| Vector retrieval | pgvector 0.8.6 initially | Qdrant retained as specialist alternative; LanceDB for rebuildable indexes; Chroma and Deep Lake deferred | `ADR-002`; Wave 2 disposable evaluation |
| Model runtimes | Ollama primary; LM Studio laboratory/fallback | llama.cpp and vLLM deferred | `ADR-003` |
| Bootstrap orchestration | IRIS-owned adapter accepted; OpenClaw retained only as a removable, digest-pinned bootstrap provider | Hivemind and Gamut patterns only; Shoal blocked on identity | `ADR-004`; Wave 2 evaluation; Wave 5 bounded proof |

## Registry Update Rule

Every update must include exact identity, version, source, license/security evidence, decision, owner, interfaces, limitations, replacement, removal, and approval provenance.
