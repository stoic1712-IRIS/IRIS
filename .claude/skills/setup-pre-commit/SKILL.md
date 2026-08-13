---
name: setup-pre-commit
description: Draft a pre-commit hook proposal (Husky + lint-staged + Prettier, typecheck, tests) for Founder review. Use when the user wants to add pre-commit hooks or commit-time formatting/typechecking/testing in this project.
---

# Setup Pre-Commit Hooks (Proposal-Only)

**STOIC-IRIS boundary — this skill never installs anything.** Git hooks are a protected control surface here, and dependency operations require explicit task-record authorization. This skill produces a **proposal** — the exact dependency operation, files, and verification steps — and hands it to the Founder, who authorizes the dependency change and applies (or delegates, via an explicit task record) the installation. Never weaken or bypass hooks that already exist.

## What the proposal sets up

- **Husky** pre-commit hook
- **lint-staged** running Prettier on all staged files
- **Prettier** config (if missing)
- **typecheck** and **test** scripts in the pre-commit hook

## Steps

### 1. Confirm the toolchain and check registries

The package manager is fixed: **pnpm via corepack** (`pnpm-lock.yaml`). Never npm, yarn, or bun in this project. Before proposing husky/lint-staged/prettier, check `docs/registries/technology-and-platform-registry.md` and `docs/registries/dependency-attribution-registry.md` — missing registry status means the dependency is research-only until the Founder approves it, so say so in the proposal.

### 2. Draft the dependency operation (do not run it)

The proposal names the exact command the task record must authorize:

```
pnpm add -D husky lint-staged prettier
```

plus `pnpm exec husky init` (creates `.husky/` and adds `prepare: "husky"` to package.json).

### 3. Draft `.husky/pre-commit`

(No shebang needed for Husky v9+.)

```
pnpm exec lint-staged
pnpm run typecheck
pnpm verify
```

**Adapt**: `pnpm verify` is this repository's full verification command — if it is too slow for a commit gate, propose the narrower `typecheck` + targeted tests for the hook and keep `pnpm verify` as the pre-push/PR gate, and say which trade-off you chose. If the repo has no `typecheck` script, omit that line and tell the user.

### 4. Draft `.lintstagedrc`

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

### 5. Draft `.prettierrc` (only if missing)

Only propose creating it if no Prettier config exists. Defaults:

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

### 6. Hand off the proposal

Write the drafted files and the exact command list into a proposal note for the Founder (scratchpad or `docs/superpowers/proposals/`), with a verification checklist for after installation:

- [ ] `.husky/pre-commit` exists and is executable
- [ ] `.lintstagedrc` exists
- [ ] `prepare` script in package.json is `"husky"`
- [ ] `prettier` config exists
- [ ] `pnpm exec lint-staged` runs clean

### 7. Delivery (only if a task record authorizes it)

If the Founder approves and issues a bounded objective covering the exact dependency operation, implement it in a dedicated branch, stage the **exact paths** touched (`package.json`, `pnpm-lock.yaml`, `.husky/pre-commit`, `.lintstagedrc`, `.prettierrc` — never `git add .`/`-A`/`--all`), and commit with message `Add pre-commit hooks (husky + lint-staged + prettier)` ending with the Co-Authored-By Claude line. The commit passing through the new hook is a good smoke test. Deliver via PR to protected `main`; the Founder reviews independently.

## Notes

- Husky v9+ doesn't need shebangs in hook files
- `prettier --ignore-unknown` skips files Prettier can't parse (images, etc.)
- The pre-commit runs lint-staged first (fast, staged-only), then the heavier checks
