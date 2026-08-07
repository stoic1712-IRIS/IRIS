# Agent Task and Handoff Contract

**Status:** Canonical

**Version:** 1.0.0

## Objective

Define interoperable records that allow IRIS, Codex, Claude, and governed workers to exchange bounded work without relying on shared private memory.

## Records

### Task

A task binds one objective to exact repositories and base revisions. It declares the risk class, assigned role, authorization mode, exact completion-mandate text and included lifecycle actions when applicable, allowed and excluded paths, permitted and prohibited actions, acceptance commands, evidence, publisher, and Phase 0 graduation status.

### Handoff

A handoff is created by the producer after local work. It records exact result revisions or patch digests, changed paths, executed commands and exit codes, evidence, limitations, rollback instructions, and all protected actions that remain unauthorized.

### Review

A review is created by an actor independent from the producer. It identifies the exact reviewed revision, reproduces applicable checks, reports line-supported findings, declares a verdict, and records whether material disagreement remains.

## Invariants

- IDs are stable and unique within the project.
- Commit identifiers use full 40-character lowercase Git object IDs.
- Digests use `sha256:` followed by 64 lowercase hexadecimal characters.
- Paths are repository-relative and use `/` separators.
- Commands are recorded exactly as executed with repository and exit code.
- A changed target, payload, dependency, provider, exposure, or risk invalidates stale authorization.
- A completion mandate is valid only when its exact Founder wording, included actions, and exclusions are recorded in the task.
- Empty findings are valid only when verification is recorded.
- A `pass` verdict is not permission to commit, push, merge, deploy, or publish.
- Secrets and raw credentials are prohibited in every record.

## Schemas

- `.iris/coordination/task.schema.json`
- `.iris/coordination/handoff.schema.json`
- `.iris/coordination/review.schema.json`

The schemas are structural interoperability contracts. Canonical governance remains authoritative when a syntactically valid record conflicts with policy.
