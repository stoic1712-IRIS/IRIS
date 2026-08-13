---
name: git-guardrails-claude-code
description: Draft a PreToolUse hook proposal that blocks dangerous git commands (push, reset --hard, clean, branch -D, broad staging, etc.) for Founder review. Use when the user wants to prevent destructive git operations or add git safety hooks in this project.
---

# Git Guardrails (Proposal-Only)

Drafts a PreToolUse hook that intercepts and blocks dangerous git commands before Claude executes them.

**STOIC-IRIS boundary — this skill never installs anything.** Hook and `.claude/settings.json` changes are protected governance surfaces in this project: Claude must not create, copy, or modify hooks or settings directly, and must never weaken existing ones. This skill produces a **proposal** — the hook script and the exact settings diff — and hands it to the Founder for independent review and installation. The `~/.claude` (all-projects) scope is out of bounds entirely; only a repository-scoped proposal is drafted.

## What the proposed hook blocks

- `git push` (all variants including `--force`) — delivery is a protected publisher action
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .` / `git restore .`
- Broad staging: `git add .`, `git add -A`, `git add --all` — this project stages exact paths only
- History rewriting: `git filter-branch`, `git rebase -i`, `git commit --amend` on shared history

When blocked, Claude sees a message telling it that it does not have authority to run the command.

## Steps

### 1. Confirm the objective

Verify there is a Founder objective (and, for the repository, a task record under `.iris/coordination/tasks/`) covering a guardrail proposal. This skill only ever targets project scope — `.claude/settings.json` in the repository — via Founder-applied changes.

### 2. Draft the hook script

The bundled reference script is at [scripts/block-dangerous-git.sh](scripts/block-dangerous-git.sh). Copy it into the proposal directory (scratchpad or the objective's worktree under a clearly-proposal path, e.g. `docs/superpowers/proposals/<date>-git-guardrails/`), adjusting the pattern list to the repo's needs. Do **not** place it at `.claude/hooks/` yourself.

### 3. Draft the settings diff

Include in the proposal the exact JSON the Founder would merge into `.claude/settings.json` (merging into any existing `hooks.PreToolUse` array — never overwriting other settings):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-git.sh"
          }
        ]
      }
    ]
  }
}
```

### 4. Ask about customization

Ask if the user wants patterns added or removed. Never propose removing a pattern that a canonical governance rule requires (force-push, broad staging, history rewriting) — flag such a request as a governance conflict instead.

### 5. Verify the draft and hand off

Test the drafted script in place (this touches nothing protected):

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | bash <path-to-drafted-script>
```

It should exit with code 2 and print a BLOCKED message to stderr. Also verify a benign command (`git status`) exits 0.

Then hand the Founder a short proposal note: what the hook blocks, where the script should be copied (`.claude/hooks/block-dangerous-git.sh`, `chmod +x`), the settings JSON to merge, and the verification command — so the Founder can install and independently verify it. State plainly that the hook is unverified-in-place until the Founder installs and tests it.
