# Cycle Nine Phase 0 Graduation Readiness

**Status:** Local implementation under Founder-authorized Cycle Nine A review

## Objective

Cycle Nine A joins the already canonical local executable-worker, independent-review, checkpoint-first delivery, GitHub provider, and rollback capabilities behind one IRIS-owned fail-closed graduation contract. It prepares deployed IRIS to perform the permanent Phase 0 Development Independence gate herself.

This implementation is machinery readiness. It does not perform or claim the final graduation. During that future execution, Claude and Codex are audit-only and must not modify either repository.

## Exact proposal and approval

The proposal binds deployed IRIS as the actor, distinct Core and Command Center base revisions, the deployed runtime identity, one real loopback model identity, prior model inspection of the exact canonical revision, the complete nested Cycle Eight executable-worker proposal and its digest, a unique candidate branch, at least two exact safe write paths, the private checkpoint repository and ref, delivery branch, exact verification commands, checkpoint-first ordering, independent review, merge, history-preserving rollback, USD 0 maximum cost, timeout, expiry, and explicit false values for Codex mutation, Claude mutation, and fixture execution.

The initial Founder approval is one-time and must match the proposal digest, exact typed statement, authenticated Founder identity, paired loopback session, CSRF verification, and issue time. A durable adapter-owned consumption ledger must return a receipt bound to the proposal and approval identifiers before execution starts. An expired, future-dated, consumed, altered, unauthenticated, or mismatched approval fails before material adapter execution. If a ledger call may have written before throwing, consumption state is `unknown`, never falsely reported as `false`.

Merge requires a second one-time Founder approval created only after delivery and independent review. It binds the exact proposal digest, pull-request number, reviewed candidate commit, delivery commit, authenticated session, and merge statement. It is durably consumed separately from the initial graduation approval.

## Required execution chain

1. Verify deployed IRIS, the Command Center, the real local model, exact local/remote/provider `main`, the private checkpoint repository, ephemeral provider credential readiness, zero pre-existing provider resources, and observed non-participation by Codex and Claude.
2. Execute the existing bounded real-model worker and require a successful candidate commit that differs from and has verified ancestry from the exact canonical base, binds distinct base and candidate tree digests plus a verified diff digest, equals the nested proposal's exact write paths and verification commands, preserves a verified journal chain and workspace cleanup, binds real-model endpoint and non-future repository-inspection evidence, and records non-participation by Codex and Claude.
3. Require the exact governed `iris-independent-review-worker` to pass the exact candidate commit and the same base, candidate-tree, and diff evidence with no findings and to record its actor, repository, verification commands, and operator non-participation. The producing worker cannot review itself.
4. Deliver checkpoint-first through IRIS. The private checkpoint, target branch, and draft pull request must all identify the candidate commit itself; delivery may not substitute a different commit.
5. Obtain and durably consume the separate digest-bound Founder merge approval, then merge only the independently reviewed exact pull-request head with a history-preserving merge commit.
6. Verify local, remote, and provider-authoritative `main` all equal the merge commit.
7. Preserve exact `git revert -m 1 <merge-commit>` evidence for the first-parent integration merge, ancestry proof, and private-checkpoint recoverability.
8. Remove execution and delivery workspaces, preserve the journal, clear the ephemeral credential, terminate any paid resources, and prove provider-authoritative zero resources.

Every event includes the digest of its exact evidence and links the preceding event digest. The event-chain verifier rejects sequence, evidence-digest, previous-digest, or event-digest tampering. Any mismatch fails closed at the actual attempted stage and still attempts cleanup, paid-resource termination, and provider-authoritative repository/resource inspection. Failure reporting preserves whether canonical state changed, did not change, or could not be verified rather than assuming safety after an adapter exception.

## Boundary with Cycle Eight and Release Eight

Cycle Eight remains the local candidate producer. Release Eight remains the checkpoint-first branch and draft pull-request delivery primitive. Cycle Nine does not weaken either contract. It adds the missing top-level binding, separate IRIS review, governed merge, canonical-main equality, rollback, cleanup, and zero-resource completion chain.

## Verification

Contract tests must cover exact success ordering and denial or failure for:

- altered, consumed, or expired Founder approval;
- future-dated or unauthenticated approval, durable-ledger replay, and altered merge approval;
- non-IRIS, non-deployed, fixture, mock, dummy, stale-inspection, operator-assisted, or model-mismatched execution;
- a nested executable-worker proposal with a different repository, revision, branch, digest, verification command, protected path, or fewer than two files;
- local, remote, provider, or Command Center base drift;
- any reviewer other than the exact IRIS independent-review worker, changed review commit, or findings;
- a delivery commit different from the candidate, checkpoint, target, pull-request, merge-head, merge-approval, or canonical-main inequality;
- incorrect rollback command or missing recoverability;
- cleanup, paid-resource termination, provider residue, provider mutation followed by an exception, or provider state that cannot be verified; and
- any attempt to treat local tests as the final Phase 0 graduation.

The full `pnpm verify` suite remains required from a Linux-consistent pinned dependency tree. Passing tests prove machinery readiness only. They do not make the branch or Phase 0 canonical; that requires governed integration, provider equality, deployment where applicable, and the later genuine IRIS-only graduation.
