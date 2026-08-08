# Phase 2-3 GitHub Evidence CLI Implementation Plan

> Execute this plan in the isolated `iris/phase-2-3-sovereign-capability-charter` worktree. Do not publish without separate authorization.

**Goal:** Publish the approved Phase 2-3 charter candidate and locally implement one canonical read-only GitHub evidence engine used by both IRIS and Codex.

**Architecture:** IRIS Core owns `scripts/dev/iris-dev.mjs`. The personal Codex skill delegates only its `github` command family to that exact file. Core tests exercise provider behavior with a deterministic fake `gh` seam and real temporary Git repositories. Personal skill tests exercise exact delegation and fail-closed behavior.

**Technology:** Node.js 24.19.0, pnpm 11.20.0, Vitest, Git, GitHub CLI.

## Task 1: Bind governance and scope

**Files:**

- Add `.iris/coordination/tasks/phase-2-3-charter-and-github-evidence-cli.json`
- Update `docs/governance/phase-2-3-sovereign-capability-evolution-charter.md`
- Preserve `docs/source-material/STOIC-IRIS_Phase_2-3_Sovereign_Capability_Evolution_Charter.docx`
- Update `docs/operations/stoic-iris-project-context.md`
- Add this design and plan

**Checks:** Validate the coordination record, format the text artifacts, render and visually inspect the DOCX, and verify material Markdown/DOCX parity.

## Task 2: Write failing Core contract tests

**Files:**

- Add `tests/iris-dev-github.test.ts`

Write focused failing tests for command help, preflight, PR inspection, CI diagnosis, handoff, merged equality, output caps, malformed responses, and redaction. Run the focused test and confirm failure is caused by the missing implementation.

## Task 3: Implement the canonical Core engine

**Files:**

- Add `scripts/dev/iris-dev.mjs`
- Update `package.json`

Implement the smallest code that passes the focused tests. Use argument arrays, bounded output, stable structured results, explicit check buckets, and no GitHub mutation commands.

## Task 4: Write failing personal-skill delegation tests

**Files outside the repository:**

- Update `C:/Users/Admin/.codex/skills/iris-dev/scripts/iris-dev.test.mjs`

Add tests proving exact `github` argument forwarding and fail-closed behavior when the canonical engine is missing. Confirm the new tests fail before modifying the personal CLI.

## Task 5: Implement the Codex-side delegation and instructions

**Files outside the repository:**

- Update `C:/Users/Admin/.codex/skills/iris-dev/scripts/iris-dev.mjs`
- Update `C:/Users/Admin/.codex/skills/iris-dev/SKILL.md`

Delegate the exact `github` family to Core without a shell or hidden fallback. Document when each proof is required and retain all existing personal commands.

## Task 6: Verify and review

Run:

1. the focused Core Vitest file;
2. the personal `iris-dev` test suite;
3. Core formatting, lint, typecheck, full tests, build, and diagnostics through the pinned WSL toolchain;
4. coordination task validation and exact-path scope checks;
5. a live read-only preflight against both repositories; and
6. an exact diff/security review.

Record failures and repairs. Do not stage, commit, push, create a pull request, merge, or clean the worktree without separate publication authority.
