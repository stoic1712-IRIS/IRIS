#!/bin/bash
# Proposed PreToolUse hook for STOIC-IRIS — installed only by the Founder
# after independent review. Blocks git commands this project's governance
# prohibits for agent operators.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

DANGEROUS_PATTERNS=(
  "git push"
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "reset --hard"
  "git add \."
  "git add -A"
  "git add --all"
  "git filter-branch"
  "git rebase -i"
  "commit --amend"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. STOIC-IRIS governance prevents you from doing this — stage exact paths, deliver via the designated publisher workflow, and never rewrite history." >&2
    exit 2
  fi
done

exit 0
