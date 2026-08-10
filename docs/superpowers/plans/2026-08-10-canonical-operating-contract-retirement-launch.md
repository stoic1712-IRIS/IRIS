# Canonical Operating Contract Retirement and Launch Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove which legacy artifacts are redundant, retire only safe replacements, clean stale disposable workspaces, synchronize both canonical repositories, and launch IRIS against the single operating contract.

**Architecture:** Cleanup is evidence-driven and occurs only after Core and Command Center consumers pass compatibility and live tests. A deterministic inventory classifies every candidate as keep, generated, compatibility alias, archive, or delete and refuses ambiguous/dirty/unmerged targets. Launch certification then proves the five operating outcomes without claiming Phase 0 graduation.

**Tech Stack:** Git 2.55, Node.js 24.19, pnpm 11.20, existing `iris-dev`, PowerShell, GitHub CLI, Core/Command Center verification suites, and loopback runtime diagnostics.

## Global Constraints

- Run only after both operating-contract implementation tranches are independently reviewed and merged.
- Preserve all canonical source documents, governance, architecture, ADRs, evidence, approvals, Git history, releases, completed wave/cycle records, and Phase 0 records.
- Never delete a dirty, unmerged, unknown, canonical, or broadly computed path.
- Never use force removal, force-push, destructive reset, history rewriting, or broad filesystem targets.
- Every deletion requires an exact resolved path, zero unique commits, zero uncommitted changes, zero live references, a replacement, and rollback evidence.
- Full Access remains ordinary-capability access; protected effects remain separately approved.
- Do not execute the Phase 0 graduation proposal in this plan. Its live run is a separate Founder-approved workflow with Codex and Claude audit-only.

## File Map

**Create**

- `scripts/dev/operating-contract-retirement.mjs` — deterministic repository/reference/worktree inventory and exact refusal checks.
- `tests/operating-contract-retirement.test.ts` — classification, reference, dirty/unmerged/canonical, and path containment tests.
- `docs/operations/operating-contract-retirement-inventory.md` — exact artifact disposition table and replacement evidence.
- `evidence/operating-contract/canonical-operating-contract-launch-2026-08-10.md` — merge, synchronization, cleanup, startup, smoke, rollback, and residual limitations.

**Update after the Core merge**

- `C:\Users\Admin\.codex\skills\iris-dev\SKILL.md` — point the personal companion skill to Core's `iris-dev contract inspect --json`; do not copy contract rules into the skill.

**Modify only after inventory approval**

- Exact legacy prompt, static capability, compatibility route, obsolete generated artifact, and disposable-worktree paths classified `delete` in the approved inventory.

## Execution Preconditions

1. Core `main` and Command Center `main` contain their reviewed operating-contract merge commits and equal `origin/main`.
2. Full verification passes in both canonical checkouts.
3. Contract version and digest match across Core, gateway startup, safe projection, and evidence.
4. Independent review reports no unresolved Critical or Important finding.
5. The Founder approves the exact retirement inventory before any file or worktree removal.

---

### Task 1: Produce a deterministic retirement inventory

**Files:**

- Create: `scripts/dev/operating-contract-retirement.mjs`
- Create: `tests/operating-contract-retirement.test.ts`
- Create: `docs/operations/operating-contract-retirement-inventory.md`

**Interfaces:**

- Consumes: exact canonical repository roots, `git worktree list --porcelain`, branch/ref state, `rg` reference results, and replacement paths.
- Produces: JSON inventory entries with `path`, `kind`, `disposition`, `references`, `replacement`, `clean`, `merged`, `canonical`, `rollback`, and `reason`.

- [ ] **Step 1: Write failing classification tests**

```ts
it.each([
  [canonicalRoot, "keep"],
  [dirtyWorktree, "keep"],
  [unmergedWorktree, "keep"],
  [referencedLegacyFile, "compatibility-alias"],
  [cleanMergedUnreferencedWorktree, "delete"],
])("classifies %s as %s", (candidate, expected) => {
  expect(classifyRetirementCandidate(candidate).disposition).toBe(expected);
});
```

Add traversal tests rejecting `/`, `C:\`, `C:\Projects`, home, either canonical root, unresolved environment variables, globs, and paths outside `C:\Projects`.

- [ ] **Step 2: Run and confirm missing-module failure**

```powershell
$env:COREPACK_ENABLE_NETWORK = '0'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-contract-retirement.test.ts
```

- [ ] **Step 3: Implement read-only inventory mode**

The script accepts only:

```text
node scripts/dev/operating-contract-retirement.mjs inventory --core C:\Projects\STOIC-IRIS --command-center C:\Projects\iris-founder-command-center-main --json
```

It must not contain a delete command. It resolves literal paths, invokes Git without a shell, and reports evidence. It scans known legacy phrases, authored static capability data, duplicate runtime policy, linked worktrees, orphan candidate roots, and historical checkouts.

- [ ] **Step 4: Generate the Markdown inventory**

For every candidate, record the exact classification and replacement. Required groups:

- canonical source and governance: `keep`;
- compiled contract: `generated`;
- migration bridge with live references: `compatibility-alias`;
- superseded planning/reference material retained for history: `archive`;
- clean merged unreferenced disposable artifact: `delete`.

- [ ] **Step 5: Run focused tests and commit the inventory tooling**

```powershell
& 'C:\Program Files\nodejs\corepack.cmd' pnpm exec vitest run tests/operating-contract-retirement.test.ts
git add -- scripts/dev/operating-contract-retirement.mjs tests/operating-contract-retirement.test.ts docs/operations/operating-contract-retirement-inventory.md
git diff --cached --check
git commit -m "chore: inventory superseded IRIS artifacts"
```

---

### Task 2: Retire approved in-repository compatibility artifacts

**Files:**

- Modify/Delete: only exact repository paths marked `delete` in the Founder-approved inventory.
- Modify: `docs/operations/operating-contract-retirement-inventory.md`
- Modify: tests that prove the replacement path.

**Interfaces:**

- Consumes: approved inventory digest and merged contract consumers.
- Produces: no duplicate active policy, no generic refusal fallback, no authored static capability status, and passing replacement tests.

- [ ] **Step 1: Recompute and compare the inventory digest**

Run inventory again. Stop if any candidate path, reference, clean state, merge state, replacement, or disposition differs from the approved inventory.

- [ ] **Step 2: Write replacement-presence tests before removal**

For each legacy artifact, add or identify a test that calls the canonical replacement. For removed fallback text, add a scan test asserting active runtime sources do not contain `You have no execution authority`, `activation remains protected until the live worker runtime`, `run these commands in your terminal`, or authored Cycle Three status.

- [ ] **Step 3: Remove only exact approved paths**

Use `apply_patch` for repository files. Do not use recursive filesystem deletion for tracked files. Preserve aliases still referenced by a released consumer.

- [ ] **Step 4: Run focused and full tests**

```powershell
$env:COREPACK_ENABLE_NETWORK = '0'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm verify
git diff --check
git status --short
```

- [ ] **Step 5: Commit exact retirement paths**

Stage every approved removed/modified path by literal name, inspect `git diff --cached --name-status`, compare it to the approved inventory, and commit:

```powershell
git commit -m "chore: retire superseded IRIS control paths"
```

---

### Task 3: Clean approved disposable worktrees and orphan candidates

**Files:**

- External exact paths: only approved `delete` entries under `C:\Projects`.
- Modify: `docs/operations/operating-contract-retirement-inventory.md`

**Interfaces:**

- Consumes: current `git worktree list --porcelain`, per-worktree status, branch ancestry, candidate journals, and approved path list.
- Produces: clean worktree registrations, no proven orphan candidates, and recoverable branch/history evidence.

- [ ] **Step 1: Verify every exact target immediately before cleanup**

For each target record resolved absolute path, owning repository, branch/detached state, HEAD, `git status --porcelain`, merge-base with `main`, branch containment, and whether the path is registered.

- [ ] **Step 2: Preserve branches and journals**

Never delete a branch in this task. If a clean worktree branch is merged, remove only the worktree registration through `iris-dev worktree clean`. If an orphan candidate has a journal, retain it unless the journal proves completed cleanup and the inventory explicitly authorizes its exact path.

- [ ] **Step 3: Remove one target at a time without force**

```powershell
& 'C:\Users\Admin\.codex\skills\iris-dev\iris-dev.cmd' worktree clean --repo core --path 'C:\Projects\EXACT-APPROVED-WORKTREE' --json
```

Use the corresponding repository flag for Command Center. Stop on the first refusal or state drift.

- [ ] **Step 4: Verify cleanup after every target**

Confirm the exact path is absent, the worktree registration is absent, canonical `main` is unchanged/clean, and the preserved branch/ref still points at the recorded commit.

- [ ] **Step 5: Record cleanup evidence**

Update the inventory with executed time, command, exit code, before/after state, recovery branch/ref, and any retained target.

---

### Task 4: Publish, synchronize, restart, and certify launch

**Files:**

- Create: `evidence/operating-contract/canonical-operating-contract-launch-2026-08-10.md`

**Interfaces:**

- Consumes: reviewed Core/Command Center commits, exact task authority, GitHub PR and CI state, canonical launch scripts.
- Produces: merged remote equality, local equality, live five-outcome smoke evidence, and Phase 0 handoff readiness.

- [ ] **Step 1: Verify publication preconditions**

Run `iris-dev github preflight`, inspect changed paths and full verification evidence, ensure independent review is clean, and confirm the Founder mandate authorizes non-force push, PR creation, merge, synchronization, restart, and smoke testing.

- [ ] **Step 2: Publish and review Core first**

Push the exact Core feature branch non-force, create a PR, inspect CI, review the exact head, repair accepted findings in the same branch, reverify, and merge only the reviewed head. Record PR, commit, merge commit, and checks.

- [ ] **Step 3: Bind and publish Command Center**

Update its coordination record to the exact merged Core revision and contract digest, run full verification, push non-force, create/review/merge its PR, and record the exact provider state.

- [ ] **Step 4: Synchronize both canonical checkouts**

Fast-forward local `main` from `origin/main`. Verify branch `main`, clean status, local HEAD equals origin HEAD, and the two repositories report the same contract digest.

- [ ] **Step 5: Bind Codex's companion skill to the merged contract**

Use `skill-creator` and `superpowers:writing-skills` to add one first-read instruction to the personal `iris-dev` skill:

```markdown
Before reasoning about STOIC-IRIS capability, authority, execution, acquisition, protected effects, cleanup, or completion, run the canonical Core command `node C:\Projects\STOIC-IRIS\scripts\dev\iris-dev.mjs contract inspect --json`. Treat its validated digest-bound result as the single operating contract; this skill contains no independent policy copy.
```

Run the skill validation required by those skills. Confirm the skill is a pointer only and cannot grant authority.

- [ ] **Step 6: Restart through the verified canonical launcher**

Stop only the exact current loopback IRIS processes, launch from `C:\Projects\STOIC-IRIS` and `C:\Projects\iris-founder-command-center-main`, and verify bound addresses remain loopback-only. Do not create startup registration or public/LAN exposure in this task.

- [ ] **Step 7: Run the live five-outcome smoke matrix**

Record one authenticated example for each outcome:

1. repository inspection under Full Access -> `execute-now`;
2. absent fictional capability -> `acquire-capability` without installation;
3. repository administration request -> `request-protected-approval` without execution;
4. deliberately stopped disposable provider -> `repair-runtime` and successful recovery;
5. completed read-only objective -> `report-terminal` with evidence.

Then navigate between views, refresh, restart the gateway, and verify conversation/objective recovery and unchanged contract digest.

- [ ] **Step 8: Run final verification and review**

Run full verification in both repositories after the live smoke. Independent review checks evidence, no capability loss, no hidden protected-effect widening, cleanup, and rollback.

- [ ] **Step 9: Record launch evidence and hand off Phase 0**

Record exact revisions, contract digest, test counts, PRs, CI, loopback processes, five decisions, cleanup, rollback, and remaining provider limitations. State that IRIS is ready to propose the separate Phase 0 graduation run. Do not approve or execute it. During that later run, Codex and Claude are audit-only.
