# Phase 2-3 GitHub Evidence CLI Design

**Status:** Founder-approved for local implementation and verification

**Date:** 2026-08-08

## Objective

Give IRIS and Codex one deterministic, read-only GitHub evidence engine for the repeated checks that currently consume time and allow avoidable mistakes: wrong checkout, stale refs, hidden CI failures, unsafe pull-request state, and unsupported completion claims.

The engine supports the Phase 2 supervised-development partnership and later Phase 3 worker supervision. It does not grant repository mutation authority or satisfy the separate Phase 0 graduation gate.

## Ownership

IRIS Core owns the implementation in `scripts/dev/iris-dev.mjs`. The personal Codex `iris-dev` skill delegates the `github` command family to that checked-in engine. There is one behavioral source of truth rather than two independently evolving implementations.

If the canonical Core checkout or engine is unavailable, the personal skill fails closed with the exact missing path. It does not use a stale hidden fallback.

## Command surface

```text
iris-dev github preflight --repo core|command-center [--root PATH] [--json]
iris-dev github pr inspect --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
iris-dev github ci diagnose --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
iris-dev github handoff --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
iris-dev github merged verify --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
```

### `github preflight`

Reports the exact repository identity, GitHub authentication state without tokens, viewer permission, default branch, local branch and revision, worktree cleanliness, origin URL, provider-visible default-branch revision, local/default/origin equality, and applicable default-branch rulesets.

### `github pr inspect`

Reports exact base and head branches and OIDs, changed paths, draft/state/mergeability, review decision, merge commit when present, and required-check buckets. It detects path ambiguity, mismatched repository identity, conflicts, failed checks, pending checks, and missing required checks.

### `github ci diagnose`

Locates workflow runs for the exact pull-request head OID and returns bounded, redacted failed-step logs with stable digests. Logs are capped; truncation is explicit. No artifact is downloaded and no run is retried.

### `github handoff`

Composes preflight, pull-request inspection, and CI diagnosis into one evidence record suitable for an independent reviewer or publisher. It preserves each sub-result rather than collapsing warnings into a single optimistic status.

### `github merged verify`

Proves the pull request is merged and compares the provider merge commit, provider default-branch head, local `main`, and local `origin/main`. It also reports worktree cleanliness. Any mismatch is visible and causes a non-success result.

## Safety contract

- Use `execFile`-style argument arrays; never invoke a shell.
- Permit only `gh` and `git` read operations required by these commands.
- Do not call mutation-capable GitHub endpoints or commands.
- Do not stage, commit, push, merge, fetch, retry, approve, comment, release, administer, deploy, install, or expose services.
- Redact GitHub tokens, bearer values, credential-bearing URLs, and common secret assignment forms before output or hashing.
- Cap provider output and failed logs before retention.
- Emit stable JSON with explicit `ok`, evidence, warnings, and errors.
- Use exit code `0` only when the requested proof passes; use `2` for a completed but failing proof and `1` for an unexpected CLI failure.
- Treat absent `gh`, absent authentication, unknown repository identity, malformed provider JSON, ambiguity, and stale/equality failures as evidence, not permission to improvise.

## Community pattern disposition

The implementation borrows only general interaction patterns from community GitHub CLI extensions: dashboard aggregation, notification summarization, CI status consolidation, and compact evidence handoff. No extension is installed. `gh-aw`, `gh-signoff`, `gh-dash`, `gh-notify`, and `gh-sbom` remain research references, not execution dependencies or authorities.

## Verification design

Tests must cover:

1. the exact help and command surface;
2. missing or unauthenticated `gh`;
3. wrong repository identity and unsupported repositories;
4. dirty, detached, ahead, behind, and stale/equality states;
5. open, draft, conflicted, closed, and merged pull requests;
6. successful, pending, failed, cancelled, skipped, and absent required checks;
7. CI failures with bounded logs, truncation, and secret redaction;
8. malformed provider JSON and nonzero provider commands;
9. handoff preservation of every sub-result; and
10. merged-state equality across provider, `main`, and `origin/main`.

The personal skill requires its own delegation regression test so a future change cannot silently bypass the canonical engine.

## Explicit non-goals

This tranche does not add GitHub write commands, repository administration, credentials, spending, deployment, public or LAN exposure, destructive operations, force-push, history rewriting, or Phase 0 graduation execution. Later write helpers require a separate design and exact authorization.
