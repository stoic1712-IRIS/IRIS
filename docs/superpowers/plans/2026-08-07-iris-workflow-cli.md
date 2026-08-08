# IRIS Workflow CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one checked-in `iris-workflow` CLI plus a thin personal Codex skill that share safe, deterministic IRIS runtime and repository workflows.

**Architecture:** Keep authoritative behavior in focused Node modules under `scripts/workflow/`. The CLI delegates startup and proposal generation to existing Core scripts, implements read-only inspection directly, and guards the one cleanup command with exact registration, cleanliness, containment, and confirmation checks. The Codex skill delegates to the Core entrypoint.

**Tech Stack:** Node.js 24 ESM, PowerShell 5.1 launcher, Git, Vitest 4, pnpm 11.20, Python skill validation.

## Global Constraints

- Preserve all existing IRIS capabilities and governance.
- Do not add dependency versions or edit `pnpm-lock.yaml`.
- Do not install dependencies or enable package-manager network access.
- Do not add stage, commit, push, merge, deployment, credential, spending, administration, force-push, history-rewrite, destructive-data, or approved-upgrade execution commands.
- Keep every local service loopback-only.
- Leave all implementation changes uncommitted and unpublished.

---

### Task 1: CLI contracts and parsing

**Files:**
- Create: `scripts/workflow/iris-workflow-lib.mjs`
- Create: `scripts/workflow/iris-workflow.mjs`
- Create: `tests/iris-workflow-cli.test.ts`

**Interfaces:**
- Consumes: process arguments and environment variables.
- Produces: `parseArguments(tokens)`, `resolveWorkflowRoots(options)`, `runWorkflow(argv, dependencies)`, and JSON-safe command results.

- [ ] Write tests that name the break for help, invalid commands, root resolution, and JSON output.
- [ ] Run `pnpm vitest run tests/iris-workflow-cli.test.ts` and observe the missing-feature failures.
- [ ] Implement the smallest parser, root resolver, help, `doctor`, and `status` behavior.
- [ ] Re-run the focused test and keep it green.

### Task 2: Startup and verification adapters

**Files:**
- Modify: `scripts/workflow/iris-workflow-lib.mjs`
- Modify: `tests/iris-workflow-cli.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `start-founder-command-center.ps1`, exact repository roots, and focused/full verification options.
- Produces: `start` and `verify` command results, plus `pnpm workflow -- ...`.

- [ ] Add failing tests proving startup delegates only to the full canonical launcher and verification disables package-manager network access.
- [ ] Run the focused test and observe the expected failures.
- [ ] Implement minimal startup health waiting and exact verification execution.
- [ ] Re-run the focused test and keep it green.

### Task 3: Candidate, proposal, and report workflows

**Files:**
- Modify: `scripts/workflow/iris-workflow-lib.mjs`
- Modify: `tests/iris-workflow-cli.test.ts`

**Interfaces:**
- Consumes: exact worktree path, canonical Git common directory, proposal output path, and optional report path.
- Produces: `candidate inspect`, guarded `candidate clean`, `upgrade propose`, and `report` results.

- [ ] Add failing tests for dirty cleanup, canonical cleanup, unregistered paths, confirmation mismatch, proposal output containment, and bounded report writing.
- [ ] Run the focused test and observe the expected failures.
- [ ] Implement the smallest safe adapters.
- [ ] Re-run the focused test and keep it green.

### Task 4: Personal Codex skill

**Files:**
- Create: `C:/Users/Admin/.codex/skills/iris-workflow/SKILL.md`
- Create: `C:/Users/Admin/.codex/skills/iris-workflow/agents/openai.yaml`
- Create: `C:/Users/Admin/.codex/skills/iris-workflow/scripts/iris-workflow.cmd`

**Interfaces:**
- Consumes: canonical `scripts/workflow/iris-workflow.mjs` or explicit `IRIS_WORKFLOW_ROOT`.
- Produces: `$iris-workflow` and `iris-workflow.cmd` delegation without duplicated workflow logic.

- [ ] Capture the baseline failure: the personal wrapper does not exist.
- [ ] Initialize the skill with the standard generator.
- [ ] Replace placeholders with concise authoritative guidance and a delegating wrapper.
- [ ] Execute the wrapper against the isolated worktree and validate the skill folder.

### Task 5: Verification

**Files:**
- Verify all files above plus the existing launcher hardening paths.

**Interfaces:**
- Consumes: focused tests, repository `pnpm verify`, wrapper validation, and Git status.
- Produces: evidence-backed local completion report.

- [ ] Run the focused CLI and launcher tests.
- [ ] Run the personal skill validator and wrapper smoke tests.
- [ ] Run full `pnpm verify` with the pinned offline toolchain.
- [ ] Inspect exact changed paths and confirm no stage or publication occurred.
