# Repository, Documentation, and Evidence Conventions

**Status:** Canonical

**Version:** 1.0.0

## Repository Layout

| Path | Purpose |
| --- | --- |
| `apps/` | Deployable IRIS interfaces or services created after their governing wave |
| `packages/` | Reusable IRIS-owned libraries and contracts |
| `docs/governance/` | Constitution, policies, standards, gates, and inventories |
| `docs/architecture/` | Architecture specifications and decision records |
| `docs/registries/` | Technology, platform, dependency, capability, and provenance registries |
| `docs/specifications/` | Component, contract, schema, and acceptance-test specifications |
| `evidence/wave-N/` | Immutable or transparently superseded wave evidence |
| `scripts/` | Reproducible diagnostics, verification, maintenance, and development commands |
| `tests/` | Cross-package and acceptance tests when not colocated |

Directories are created only when required; empty ornamental structure is discouraged.

## Naming

Use lowercase kebab-case for Markdown and script filenames unless a tool requires otherwise. Branches use `iris/<bounded-purpose>`. Architecture decisions use `ADR-NNN-short-title.md`. Evidence names identify the wave, subject, and result without secrets.

## Document Status

Every governing document must state status, version, date, authority, and Founder decision block when canonical approval is required. Allowed statuses are draft, Founder-approved with commit pending, canonical, superseded, and retired.

Canonical documents must reference the approval and commit that activated them. Drafts must not claim authority.

## Documentation Quality

Documents must identify scope, governing sources, decisions, requirements, exclusions, evidence, limitations, rollback or amendment process, dependencies, and completion gate. Unresolved questions must be explicit; placeholders must not masquerade as completed requirements.

## Evidence Rules

Evidence must record exact scope, files, revision, tools and versions, commands, results, failures, repairs, security and license findings, limitations, rollback, cleanup, provider pins, approvals, and recommended next capability.

Evidence is append-only in meaning. Corrections must identify supersession rather than conceal prior results. Generated evidence must be deterministic where practical, text-reviewable, secret-scanned, and separated from temporary logs.

## Sensitivity and Publication

Before committing evidence, classify it as public, internal, sensitive, secret, or recovery authority. Public repository history is presumed permanently copied. Sensitive or secret material must not be committed without an exact approved exposure decision; secrets are never committed.

## Source References

Read-only project source documents may guide repository artifacts but must not be silently modified or copied as canonical without an approved source-management decision. Repository-native documents must state whether they reproduce, reconcile, supersede, or derive from an external source.

## Generated Files

Generated files must name their generator, input sources, reproducibility command, and whether they are canonical evidence or disposable output. Binary evidence requires a human-readable index or summary.

## Review

All changed Markdown must pass whitespace checks, broken-reference review, status/provenance validation, contradiction review, and sensitive-content inspection before commit.

## Founder Decision

- [x] Approved as canonical conventions
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:**

**Decision date:**

**Approved version or commit:**

**Notes:**
