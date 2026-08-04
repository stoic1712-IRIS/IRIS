# Technology and Platform Registry

**Status:** Founder-approved baseline; canonicalization commit pending

## Platforms

| Platform | Role | Current state | Permanent IRIS boundary |
| --- | --- | --- | --- |
| Windows 11 | Founder workstation host | Operational | Replaceable environment |
| Ubuntu 26.04 LTS on WSL2 | Primary Linux development environment | Certified | Replaceable environment |
| GitHub `stoic1712-IRIS/IRIS` | Remote repository | Operational; currently public | Repository provider, not governance owner |
| Docker Desktop / Engine | Disposable container runtime | Certified | Replaceable execution provider |
| Ollama | Local model runtime | Certified with Qwen3 8B | Replaceable model provider |
| LM Studio | Model laboratory and fallback API | Installed; no LLM/server in certification | Replaceable model provider |

## Technology Decisions Pending Wave 2

Coordination, durable workflow, memory, vector search, orchestration, model adapters, and external candidate technologies remain evaluation subjects. No candidate is adopted by being named in a source document or registry.

## Registry Update Rule

Every update must include exact identity, version, source, license/security evidence, decision, owner, interfaces, limitations, replacement, removal, and approval provenance.
