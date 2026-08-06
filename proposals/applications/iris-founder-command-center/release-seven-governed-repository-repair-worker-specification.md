# IRIS Founder Command Center Release Seven Specification

**Specification:** `iris.stoic/governed-repository-repair-worker/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Objective

Release Seven enables IRIS to generate and verify one bounded candidate repair in a disposable local Git worktree after authenticated, exact, one-time Founder approval. It converts an immutable Release Six review finding or an independently supplied exact defect statement into reviewable candidate evidence. It does not authorize a canonical edit, staging, committing, pushing, pull-request creation, merging, deployment, credentials, provider resources, spending, or self-approval.

## Preconditions

- The target repository is exactly `stoic1712-IRIS/IRIS` or `stoic1712-IRIS/iris-founder-command-center`.
- The target revision is a full 40-character commit already present in the canonical local repository and equal to the approved remote revision recorded in the proposal.
- The defect source is either an immutable Release Six result with validated citations or a Founder-supplied defect statement bound into the proposal digest.
- The proposal binds the repository, revision, merge base when applicable, finding digest, editable-file allowlist, read-only context allowlist, verification command identifiers, model, limits, expiration, cleanup plan, and expected zero-cost boundary.
- The canonical repository and canonical working tree are clean for the bound paths. Uncommitted content is never imported into the candidate workspace.
- Every exact dependency is already present in the local pnpm content-addressable store; missing cached content fails closed.

## Protected Action

Candidate-repair generation is an `R2` material-repair action. Activation requires an authenticated, exact, one-time, digest-bound Founder approval. Approval is consumed before workspace creation or model invocation. A stale, altered, replayed, or mismatched approval fails closed.

## Inputs

- One repository and one immutable base revision.
- One bounded defect statement and optional validated Release Six findings.
- At most 20 editable regular-text files and 40 read-only context files.
- At most 1 MiB aggregate model input.
- An exact set of allowlisted verification command identifiers resolved by IRIS, never by the model.
- Local Ollama model `qwen3:8b` at `http://127.0.0.1:11434`.

## Repair Method

1. Revalidate proposal and approval material.
2. Verify local and remote revision equality without modifying either repository.
3. Create a uniquely named disposable worktree from the exact base revision under an approved workspace root.
4. Materialize only the already pinned dependency graph with offline, frozen-lockfile, no-lifecycle-script settings; reject downloads, manifest changes, lockfile changes, and missing cache content.
5. Read only committed, allowlisted UTF-8 regular files through fixed Git operations.
6. Send delimited untrusted source and defect evidence to the local model with no tools, shell, browser, credentials, or network destinations.
7. Require a strict structured response containing complete replacement text for explicitly allowlisted files, rationales, and expected verification impact.
8. Validate path identity, content encoding, size, file count, prohibited content, and the aggregate change budget before writing.
9. Apply validated replacements only inside the disposable worktree using exclusive file creation or replacement semantics that reject links and path traversal.
10. Compute the exact candidate manifest and diff digest.
11. Run only the proposal-bound verification command identifiers with fixed executables, arguments, environment, timeouts, and output limits.
12. Return structured candidate evidence and terminate the model.
13. Preserve the candidate only for the approved review window; otherwise delete it and verify cleanup.

## Output

The result contains `verified`, `needs-repair`, or `failed`; the immutable base revision; candidate manifest; unified-diff digest; per-file before and after digests; bounded model rationale; verification command results; warnings; cleanup deadline; and an exact next approval statement. The result is advisory and noncanonical. It never represents approval or permission to publish.

## Repair and Reapproval

If verification fails, IRIS may explain the failure and propose one bounded repair iteration. It may not execute that iteration until the Founder approves a new digest-bound proposal. Each iteration receives a new proposal identifier, approval, candidate workspace, diff digest, and evidence record. Silent retry, scope expansion, and automatic acceptance are prohibited.

## Success Criteria

- All schemas and approval checks fail closed.
- Only allowlisted candidate files change, and only in the disposable worktree.
- The model has no shell, Git, tool, credential, provider, browser, or general-network capability.
- Verification uses only fixed command definitions and produces bounded evidence.
- The canonical repositories, refs, index, working trees, remotes, and GitHub state remain unchanged.
- Candidate rollback and cleanup are proven.
- No paid resources are created and maximum cost remains USD 0.

## Explicit Non-Goals

- Canonical repository mutation.
- Stage, commit, push, pull-request, review-submission, merge, release, or deployment authority.
- Dependency-version, manifest, lockfile, or toolchain changes; online installation; or lifecycle scripts.
- Persistent credentials, autonomous memory mutation, background execution, or startup registration.
- Public, LAN, or non-loopback exposure.
- Phase 0 graduation by simulation, fixture, or single-file demonstration.
