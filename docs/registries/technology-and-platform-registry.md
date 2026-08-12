# Technology and Platform Registry

**Status:** Canonical baseline

## Platforms

| Platform | Role | Current state | Permanent IRIS boundary |
| --- | --- | --- | --- |
| Windows 11 | Founder workstation host | Operational | Replaceable environment |
| Ubuntu 26.04 LTS on WSL2 | Primary Linux development environment | Certified | Replaceable environment |
| GitHub `stoic1712-IRIS/IRIS` | Remote repository | Operational; Founder-approved public visibility; `Protect main` active | Repository provider, not governance owner; all history treated as public disclosure |
| GitHub Actions REST API | Scoped graduation resource authority | Live provider-authoritative graduation proof passed | Replaceable provider; cannot expand proposal authority or survive scoped cleanup |
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
| Sovereign development | IRIS-owned proposal, approval, disposable-worktree, execution, verification, checkpoint, rollback, cleanup, and GitHub Actions provider-verification runtime | Historical Wave 10 checkpoint `468f81e4` verified the machinery; permanent Phase 0 graduation remains pending one genuine deployed Founder-operated canonical self-upgrade with Codex and Claude audit-only | Wave 10 evidence; Phase 0 graduation activation specification |
| Infrastructure blueprints | IRIS-owned portable `iris.stoic/v1` schema, validator, profiles, Compose compiler, rollback and removal manifests | Wave 11 canonical; decision gate passed | ADR-005; Wave 11 specification and evidence |
| Visual infrastructure editing | React Flow `12.11.2` with ELK.js `0.12.0` behind IRIS-owned conversion/layout boundaries | Wave 11 composer implemented; no deployment or self-approval authority | ADR-005; Wave 11 evidence |
| Application Factory | IRIS-owned exact application specification, capability approval, private-repository proposal, integration-file generation, blueprint, verification, lifecycle, and maintenance planning | Wave 12 implemented with disposable local proof; no external application repository created | ADR-006; Wave 12 specification and evidence |
| Continuous Evolution | IRIS-owned research intake, benchmarks, comparisons, upgrade/deprecation/native-replacement/roadmap/self-improvement proposals | Wave 12 implemented; every proposal remains pending Founder approval and non-executable | ADR-006; Wave 12 specification and evidence |
| Governed research and connectors | SearXNG search, Playwright browser inspection, and MCP TypeScript SDK behind the Cycle Six governed tool gateway | **Adopted**: SearXNG image `sha256:f4c8e59de166ed71f6380c0847c312ca51f0d41996e31d0559163b6b09ecde52` (loopback-only), Playwright `1.62.0` (ephemeral Chromium), `@modelcontextprotocol/sdk 1.30.0` (local stdio only); remote MCP transport remains unavailable | ADR-007; Cycle Six specification and evidence |
| Ephemeral screenshot capture | Playwright-backed, byte- and dimension-bounded, redaction-attested, ephemeral, metadata-only capture behind an IRIS-owned contract | **Adapter implemented, disabled by default**: an authorized caller must supply an already-governed browser-page resolver; bytes stay inside the adapter, sensitive controls are solid-filled, and only attested metadata leaves it | ADR-007; Cycle Ten C-D specifications and evidence |
| Credential references | Windows Credential Manager, opaque `wcm://` reference only; IRIS never holds a value | **Reference adapter implemented, resolution unavailable**: exact known references may be registered, read by identifier, and removed; enumeration and secret retrieval remain denied | ADR-007; Cycle Ten C-D specifications and evidence |
| Local notifications | Windows native local notifications; bounded redacted plain text, non-networked, non-actionable | **Adapter implemented, disabled by default**: explicit invocation uses static PowerShell over local child-process stdin; no links/actions/input, remote delivery, or persistence | ADR-007; Cycle Ten C-D specifications and evidence |
| Desktop control | Microsoft Windows UI Automation behind the IRIS-owned Cycle Eleven contract | **Contract and inert injected adapter adopted; disabled by default**: exact application/window scope, coordinate-free bounded actions, metadata-only preview, one-shot typed approval, immediate interruption, recovery, replay denial, and mandatory audit; no live runner or desktop action is authorized | ADR-008; Cycle Eleven specification and evidence |
| Founder remote steering | Claude Code Remote Control (research preview) under the workstation-only operating rule in `docs/operations/founder-remote-control-channel.md` | **Approved as a bounded, replaceable Founder steering channel**: sessions start only from the Founder workstation IRIS worktree, never from a cloud container, shared machine, or CI; the channel carries authenticated Founder steering of an existing local session and grants no new authority; forwarded web content, attachments, and model output remain untrusted data; the session transcript is stored on Anthropic servers while connected and is treated as disclosure; auto-connect must never be enabled through checked-in settings | Task `claude-code-remote-control-operator-channel`; `evidence/remote-control/claude-code-remote-control-adoption.md` |

## Registry Update Rule

Every update must include exact identity, version, source, license/security evidence, decision, owner, interfaces, limitations, replacement, removal, and approval provenance.
