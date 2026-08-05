# Wave 10 Sovereign Development Runtime

**Status:** Runtime implemented; graduation proof requires IRIS execution and exact typed Founder approval

## Purpose

The Sovereign Development Runtime enables a real IRIS model to propose and perform a bounded multi-file repository upgrade without granting unbounded authority. Runtime implementation is not Development Independence. Graduation occurs only when IRIS completes the canonical live workflow while Codex and Claude do not modify the repository.

## Exact Proposal

A proposal binds the canonical repository, exact forty-character base revision, isolated branch, allowed and forbidden paths, at least two exact file mutations, before and after SHA-256 digests, complete resulting file content, governed commands, verification checks, private checkpoint remote, history-preserving rollback, cleanup, resource termination, provider-zero requirements, model identity, and creation time.

Traversal, absolute paths, forbidden paths, content/digest mismatches, ambiguous mutations, and single-file proposals fail schema validation.

## Typed Approval

The Founder approval binds the authenticated identity, proposal identifier, full proposal digest, timestamp, issued state, and exact statement:

`I approve <proposal-id> at <proposal-digest> for IRIS execution exactly as proposed.`

Any changed file, content, command, base revision, branch, remote, or cleanup condition changes the proposal digest and invalidates the approval. An independent-verification repair must become a new proposal and receive a new typed approval.

## Execution Lifecycle

1. Validate proposal and exact typed approval.
2. Create a disposable Git worktree at the exact base revision.
3. Verify every before digest and enforce allowed/forbidden paths.
4. Apply all exact file mutations and verify every after digest.
5. Run only the proposal's governed commands.
6. Independently compare the changed-path set and run `git diff --check`.
7. Stop for repair and reapproval if verification finds anything.
8. Create and push the checkpoint to the proposal's private remote.
9. Verify the local checkpoint SHA equals the remote branch SHA.
10. Preserve a `git revert <checkpoint>` rollback command.
11. Remove and prune the disposable worktree.
12. Terminate paid resources and query the provider until it reports zero resources.

All failures close authority, attempt workspace cleanup, terminate scoped paid resources, and preserve events.

## Real-Model Graduation Entrypoints

`scripts/development/iris-propose-upgrade.mjs` requires a clean canonical checkout, gives Qwen3 8B bounded repository context, and writes its exact proposal outside the repository. It cannot apply the proposal.

`scripts/development/iris-execute-approved-upgrade.mjs` accepts the unchanged proposal plus a matching approval record and executes through the IRIS-owned runtime. The checkpoint remote named `checkpoint` must resolve to a private repository before approval.

## Graduation Boundary

Codex may implement and verify this machinery but must stop before the live graduation workflow. The Founder must review IRIS's exact proposal and type its generated approval statement. IRIS then performs the changes, tests, build, checkpoint, remote equality, rollback evidence, cleanup, and provider-zero proof. Only that completed evidence can change Phase 0 status.
