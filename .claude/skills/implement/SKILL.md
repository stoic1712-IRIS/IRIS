---
name: implement
description: "Implement a piece of work based on a spec or set of task records."
disable-model-invocation: true
---

Implement the work described by the user in the spec or task records.

Before writing code:

- Locate and read the exact task record under `.iris/coordination/tasks/` (see `.claude/skills/setup-stoic-iris-engineering-skills/issue-tracker-iris-coordination.md`). Respect its base revisions, allowed paths, excluded paths, and acceptance commands. No task record for a material mutation → create or request one first.
- Work in a dedicated branch (and Claude-owned worktree for bounded implementations) — one bounded objective per branch. Never share a mutable worktree with another agent.

While implementing:

- Use /tdd where possible, at pre-agreed seams.
- Run typechecking regularly, single test files regularly, and the full verification suite (`pnpm verify`) once at the end. Use the repository-pinned toolchain (`pnpm` via corepack) only. Do not install or update dependencies unless the task record explicitly authorizes the exact dependency operation.
- Never weaken `.claude/settings.json`, hooks, governance, tests, or security controls to make the work pass.

Once done:

- Use /code-review as an advisory self-check. This does not substitute for independent review — the Founder reviews and approves material output; never certify your own work.
- Stage exact paths only (never `git add .`, `-A`, or `--all`) and commit to the current objective branch. End the commit message with the Co-Authored-By Claude line. All merges go via pull request to protected `main`; never force-push.
- Produce a handoff addressed to the Founder (`.iris/coordination/handoffs/`): commands run, exit codes, changed paths, limitations, rollback information, and what remains uncertified.
