---
name: resolving-merge-conflicts
description: "Use when you need to resolve an in-progress git merge/rebase conflict."
---

1. **See the current state** of the merge/rebase. Check git history, and the conflicting files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made, and what the original intent was. Read the commit messages, check the PRs (`gh pr view <n> --comments`), and read the task records they cite under `.iris/coordination/tasks/` (see `.claude/skills/setup-stoic-iris-engineering-skills/issue-tracker-iris-coordination.md`).

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off in the handoff. Do **not** invent new behaviour. Always resolve; never `--abort` — but if a resolution would require discarding another operator's material change, stop and surface the conflict to the Founder instead of silently choosing.

4. Discover the project's **automated checks** and run them — in STOIC-IRIS: typecheck and targeted tests first, then the full suite via `pnpm verify`. Fix anything the merge broke. Never weaken tests, hooks, or governance to get past a conflict.

5. **Finish the merge/rebase.** Stage the resolved files by **exact path** — never `git add .`, `-A`, or `--all` — and commit, ending the message with the Co-Authored-By Claude line. If rebasing, continue the rebase process until all commits are rebased.

**STOIC-IRIS git discipline:** never force-push and never rewrite published history. A completed local rebase of a branch that was already pushed cannot be delivered without a force-push — so for shared branches prefer a merge, and if you find yourself mid-rebase on a pushed branch, finish it locally but stop and report to the Founder before any push. Preserve unrelated user changes untouched.
