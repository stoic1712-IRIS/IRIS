# IRIS Founder Command Center Release Eight Security Contract

**Contract version:** `iris.stoic/governed-repository-delivery-worker/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Authority Boundary

Release Eight grants no standing authority. Proposal generation and status inspection are read-only. One delivery activation is an `R3` action requiring authenticated, exact, one-time, digest-bound Founder approval. The approval authorizes only the bound candidate, commit, checkpoint ref, target branch, and draft pull request. Verification does not authorize merge or canonical adoption.

## Candidate Provenance Boundary

Only an immutable Release Seven `verified` result is eligible. Its repository, base revision, proposal identifier, result digest, candidate diff digest, changed-file manifest, before and after digests, fixed verification results, canonical-mutation flag, GitHub-mutation flag, and cleanup state are revalidated. Free-form patches, working-tree changes, uncommitted files, branch tips, model claims, comments, logs, or browser state cannot substitute for this evidence.

## Repository and Ref Boundary

- Supported targets are exactly `stoic1712-IRIS/IRIS` and `stoic1712-IRIS/iris-founder-command-center`.
- The private checkpoint target is exactly `stoic1712-IRIS/IRIS-checkpoints`.
- Every local and remote base is a full 40-character commit. Mutable base drift fails closed.
- Delivery and checkpoint refs use compiled unique grammars derived from the proposal digest and must not preexist.
- Force-push, ref update, tag creation, default-branch mutation, alternate object databases, arbitrary remotes, user-supplied URLs, submodules, hooks, and credential helpers selected by the model are denied.

## Workspace and Reconstruction Boundary

The worker creates one unique disposable worktree beneath an exact approved root. It rejects symlinks, junctions, reparse-point escapes, nested repositories, path traversal, submodules, and unexpected files. Candidate reconstruction uses only the validated Release Seven diff through a fixed Git operation. The worker rechecks exact changed paths, modes, before and after blob digests, diff digest, line budget, secret policy, and dependency integrity before committing.

## Verification Boundary

The complete fixed Release Seven verification registry reruns after reconstruction and before any commit or provider write. Commands use fixed executables and arguments, sanitized environment, bounded output, timeouts, offline dependencies, disabled lifecycle scripts, and no model-selected command. A skipped, missing, truncated-as-success, or failed check denies delivery.

## Commit Boundary

Exactly one commit may be created on one unique temporary branch from the bound base. Parent, tree, author identity, committer identity, message, and changed files are verified. Git hooks are disabled. Empty commits, merge commits, additional parents, signed-content prompts, amend, interactive operations, and history rewriting are denied. The commit tree must exactly reproduce the verified candidate.

## Credential and Provider Boundary

- Credentials are obtained only by the trusted delivery controller from an approved local credential provider after approval consumption.
- Credentials exist in process memory only, are never written to repository files, proposal artifacts, logs, command arguments, model input, browser DOM, evidence bodies, or pull-request content, and are zeroed or released after use.
- Provider calls are allowlisted to GitHub HTTPS endpoints for exact repository/ref reads, checkpoint and feature-branch pushes, draft pull-request creation, and equality verification.
- The model, candidate code, verification commands, UI, and pull-request text receive no credential or arbitrary provider capability.
- The maximum paid-resource count and maximum cost are zero.

## Checkpoint Boundary

The delivery commit is pushed first to one unique ref in the private checkpoint repository. Provider-authoritative ref equality is required before target delivery continues. The checkpoint is immutable evidence: it is never force-updated or silently deleted. A different commit or existing ref fails closed.

## Target Push and Pull-Request Boundary

The same commit is pushed once to the unique target feature branch. Provider-authoritative equality is required. Exactly one draft pull request may then be created with exact base `main`, exact head branch, bounded evidence-derived text, and maintainers-modify disabled unless separately approved. Existing matching PRs are reused only when every bound field matches; ambiguity fails closed. Merge, ready-for-review, approval, comment, label, assignee, workflow dispatch, release, or deployment actions are absent.

## Approval, Replay, and Session Controls

The loopback Founder Command Center retains exact Host and origin enforcement, Fetch Metadata, HttpOnly SameSite cookies, CSRF binding, short expiry, terminal-bound one-time codes, attempt limits, constant-time comparison, and approval consumption before mutation. Delivery state is scoped to one proposal and cannot be replayed for repair, cleanup, deletion, or another repository.

## Failure, Recovery, and Rollback

Any mismatch, drift, failure, timeout, secret match, verification failure, unexpected diff, credential failure, provider denial, remote inequality, PR mismatch, cleanup failure, or evidence error stops progression. Completed provider writes are never hidden. The result identifies the last verified state and supplies history-preserving recovery. Automatic remote deletion, branch reuse, force-push, merge, or retry is prohibited.

Rollback evidence includes base ancestry, commit and tree digests, private checkpoint equality, target-ref equality, draft PR identity, canonical nonmutation proof, local cleanup, and exact commands or future proposals needed to close or delete provider state. Destructive provider rollback requires separate Founder approval.

## Required Verification

Tests must cover strict schemas; deterministic proposal and ref names; candidate-evidence validation; base and remote drift; existing refs and PRs; approval expiry, mismatch, replay, and consumption order; workspace containment; diff reconstruction; file, mode, digest, secret, and line limits; verification denial; commit parent and tree equality; disabled hooks; checkpoint-first ordering; provider equality; duplicate or mismatched PRs; credential redaction and clearance; partial failure states; no force-push or merge route; canonical nonmutation; cleanup; and one fictional real-provider delivery proof using a disposable branch and private checkpoint.

## Reapproval Triggers

Any different repository, base, candidate evidence, file, digest, commit metadata, checkpoint target or ref, branch, PR field, provider operation, credential mechanism, command, timeout, limit, workspace root, persistence, network destination, cost, cleanup action, merge action, deployment, retry, or partial-failure recovery requires a new exact proposal and Founder approval.
