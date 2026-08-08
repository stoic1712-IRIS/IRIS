# Phase 2-3 Charter and GitHub Evidence CLI Verification

**Date:** 2026-08-08  
**Task:** `phase-2-3-charter-and-github-evidence-cli`  
**Core base revision:** `6367e4547d34092472c672ee93a9e1b2a8e5c80f`  
**Branch:** `iris/phase-2-3-sovereign-capability-charter`  
**Publication state:** Local implementation verified; publication remains pending at this evidence revision.

## Delivered locally

- Founder-approved Phase 2-3 Sovereign Capability Evolution Charter in Markdown and DOCX.
- Canonical-candidate source routing in the operator project context.
- IRIS-owned read-only GitHub evidence engine with:
  - `github preflight`
  - `github pr inspect`
  - `github ci diagnose`
  - `github handoff`
  - `github merged verify`
- Personal Codex `iris-dev` delegation to the same Core implementation, with no second hidden implementation.
- Fail-closed repository identity, authentication, exact-revision, required-check, CI, redaction, log-bound, malformed-response, and merged-main equality checks.

No existing IRIS or Codex capability was removed or weakened. No community GitHub CLI extension was installed. No GitHub mutation command was added or executed.

## Red-green evidence

- Core contract tests initially failed because `scripts/dev/iris-dev.mjs` did not exist.
- Personal skill tests initially failed because GitHub delegation and command help were absent.
- A later regression reproduced a real `gh pr checks` behavior: structured failed-check JSON can accompany exit code `1`. The original implementation discarded that evidence. The new regression failed first, then passed after the parser was corrected to preserve structured checks while recording the command exit code.
- A clean-artifact verification regression reproduced the repository-wide lint failure that occurred before workspace declaration outputs existed. The new regression failed against the previous `verify` order, then passed after `pnpm build` was moved ahead of lint and typecheck.

## Passing verification

| Check | Result |
| --- | --- |
| Core task-schema validation | PASS |
| Exact-path scope check | PASS; zero violations and zero staged paths |
| Core GitHub evidence tests | PASS; 10 of 10 |
| Core focused Prettier check | PASS |
| Core focused ESLint check | PASS; zero warnings |
| Personal `iris-dev` tests | PASS; 15 of 15 |
| Repository-wide `pnpm verify` | PASS; build, lint, typecheck, 442 tests passed with 1 platform skip, and diagnostics |
| DOCX ZIP/package integrity | PASS |
| DOCX required-text integrity | PASS |
| Markdown-to-DOCX heading parity | PASS; 35 of 35 headings matched |
| DOCX accessibility audit | PASS; zero high, medium, or low findings |
| `git diff --check` | PASS |

## Live read-only provider evidence

### Core

- GitHub authentication: verified; token text was redacted from retained output.
- Repository identity: `stoic1712-IRIS/IRIS`, exact match.
- Provider, `origin/main`, and local `main`: all `6367e4547d34092472c672ee93a9e1b2a8e5c80f`.
- Rules observed: deletion protection, non-fast-forward protection, and pull-request requirement.
- Overall preflight intentionally returned `ok: false` because the isolated feature worktree has uncommitted task changes. Revision equality itself passed.

### Founder Command Center

- GitHub authentication: verified; token text was redacted from retained output.
- Repository identity: `stoic1712-IRIS/iris-founder-command-center`, exact match.
- Provider, `origin/main`, local `main`, and `HEAD`: all `edb2f882cc91deff7109491e609b733157c92e5a`.
- Worktree: clean; overall preflight passed.
- GitHub returned HTTP 403 for branch-ruleset inspection because that private-repository feature requires GitHub Pro or public visibility. The engine preserved this provider limitation as `rulesetCommandOk: false`; it did not invent a ruleset result.

## Clean-artifact verification repair

The first repository-wide `pnpm verify` run exposed a deterministic ordering bug rather than hundreds of source defects: lint ran before TypeScript project references had emitted the workspace declaration files used by package exports. The same revision passed in another worktree only because its build outputs already existed. A regression now binds the required order, and `verify` builds the referenced workspaces before lint and typecheck. The repaired full run passed without dependency installation or lockfile mutation.

## Document-render limitation

The DOCX was structurally and accessibility verified. Visual page rendering could not run because LibreOffice/`soffice` is not installed on this workstation. This limitation is reported explicitly and is not represented as visual QA completion.

## Security and authority review

- Provider commands use argument arrays through `execFile`; they are not shell-composed.
- The command surface is read-only: repository/auth/ruleset views, pull-request views/checks, workflow run views, and Git reference reads.
- Tokens, bearer credentials, secret assignments, and credential-bearing URLs are redacted before evidence retention.
- Failed-run logs are bounded and content-digested.
- No stage, commit, push, PR creation, merge, approval, comment, CI retry, administration, credential operation, deployment, spending, force-push, or history rewrite is implemented or authorized.
- This task does not execute or claim completion of the separate Phase 0 Development Independence graduation gate.
