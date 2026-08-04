# Protected Path and Branch Policy

**Status:** Canonical

**Version:** 1.0.0

## Purpose

This policy defines repository paths and Git operations that require heightened control. It applies to humans, IRIS, workers, automation, and external tools.

## Branch Model

- `main` is the authoritative integration branch.
- Ordinary work occurs on `iris/<bounded-purpose>` branches.
- One branch should represent one reviewable objective.
- Direct development commits to `main` are prohibited after branch protection is active.
- Feature branches must begin from a verified current base and preserve unrelated work.

## Protected Operations

The following always require explicit typed approval: commit, push, pull-request creation, merge, tag or release creation, branch deletion, force-push, history rewrite, default-branch change, visibility change, protection-rule change, and deletion of canonical evidence.

## Protected Paths

| Path or class | Protection reason | Minimum change requirement |
| --- | --- | --- |
| `docs/governance/**` | Constitutional and policy authority | R2 proposal, Founder review for canonical status, independent consistency check |
| `docs/architecture/**` | Permanent boundaries and decisions | ADR or reconciliation evidence; architecture review |
| `docs/registries/**` | Dependency, platform, provenance, and capability records | Evidence-backed update; license/security review when applicable |
| `.github/**` | CI, branch, issue, and release controls | R3 approval and provider-side verification |
| package manifests and lockfiles | Executable dependency and supply-chain state | Dependency identity, version, license, security review, reproducible install evidence |
| build, test, lint, formatting, and deployment configuration | Verification and release integrity | Relevant tests and review of changed enforcement behavior |
| secret, environment, credential, and access-control configuration | Sensitive authority and exposure | R3 approval; no secret values in Git |
| migration and destructive-operation code | Data and rollback risk | Exact target, backup or rollback, failure test, R3 approval when externally consequential |
| `evidence/**` | Completion and audit integrity | Append or supersede transparently; do not conceal prior failure |

Additional protected paths may be registered without reducing these defaults.

## Staging Rules

Stage only explicitly reviewed paths. Broad staging commands such as `git add .`, `git add -A`, and `git add --all` are prohibited in governed workflows. Staged content must pass scope, whitespace, secret, and generated-artifact checks before commit.

## Commit Rules

Commits must be reviewable, bounded, and accurately described. A commit must not mix unrelated user work. Canonical approvals and their provenance must be preserved without falsely claiming later actions have occurred.

## Push and Remote Equality

Push requires separate approval for the exact commits, branch, repository, and public/private exposure. After push, remote equality must be verified using a provider-authoritative ref or equivalent evidence when required by the task or gate.

## Pull Requests and Merge

Pull requests must target the verified canonical base, summarize scope, evidence, risks, limitations, and rollback, and remain draft unless the Founder requests otherwise. Merge requires separate approval and satisfied protection checks. The merging actor must not bypass required review.

## Force and History Rewrite

Force-push, rebase of published canonical history, amend of published commits, and destructive reset are prohibited except through an explicitly approved recovery plan that preserves recoverable references and documents impact.

## Branch Protection Target

Before Wave 1 completion, `main` should require pull requests, prevent force-push and deletion, require resolution of review conversations where available, and require configured baseline checks. Exact provider settings must be captured as evidence after configuration.

## Rollback

Rollback should use revert or another history-preserving operation. Deleting the evidence of an error is not rollback.

## Founder Decision

- [x] Approved as canonical policy
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:**

**Decision date:**

**Approved version or commit:**

**Notes:**
