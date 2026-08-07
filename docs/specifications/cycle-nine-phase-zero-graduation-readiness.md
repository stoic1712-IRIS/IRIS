# Cycle Nine Phase 0 Graduation Readiness

**Status:** Local implementation under Founder-authorized Cycle Nine A review

## Objective

Cycle Nine A joins the already canonical local executable-worker, independent-review, checkpoint-first delivery, GitHub provider, and rollback capabilities behind one IRIS-owned fail-closed graduation contract. It prepares deployed IRIS to perform the permanent Phase 0 Development Independence gate herself.

This implementation is machinery readiness. It does not perform or claim the final graduation. During that future execution, Claude and Codex are audit-only and must not modify either repository.

## Exact proposal and approval

The proposal binds deployed IRIS as the actor, distinct Core and Command Center base revisions, the deployed runtime identity, one real loopback model identity, the executable-worker proposal digest, candidate branch, private checkpoint repository and ref, delivery branch, exact verification commands, checkpoint-first ordering, independent review, merge, history-preserving rollback, USD 0 maximum cost, timeout, expiry, and explicit false values for Codex mutation, Claude mutation, and fixture execution.

The Founder approval is one-time and must match the proposal digest and exact typed statement. An expired, consumed, altered, or mismatched approval fails before adapter execution.

## Required execution chain

1. Verify deployed IRIS, the Command Center, the real local model, exact local/remote/provider `main`, the private checkpoint repository, ephemeral provider credential readiness, and zero pre-existing provider resources.
2. Execute the existing bounded real-model worker and require a successful candidate commit, exact proposal digest, exact verification commands, verified journal chain, and workspace cleanup.
3. Require a distinct IRIS reviewer to pass the exact candidate commit with no findings. The producing worker cannot review itself.
4. Deliver checkpoint-first. The private checkpoint, target branch, and draft pull request must all identify the same exact delivery commit.
5. Merge only the independently reviewed exact pull-request head with a history-preserving merge commit and a separately consumed merge approval.
6. Verify local, remote, and provider-authoritative `main` all equal the merge commit.
7. Preserve exact `git revert <merge-commit>` evidence, ancestry proof, and private-checkpoint recoverability.
8. Remove execution and delivery workspaces, preserve the journal, clear the ephemeral credential, terminate any paid resources, and prove provider-authoritative zero resources.

Every stage is represented by a hash-linked event. Any mismatch fails closed and attempts cleanup, resource termination, and provider-zero verification without inventing missing evidence.

## Boundary with Cycle Eight and Release Eight

Cycle Eight remains the local candidate producer. Release Eight remains the checkpoint-first branch and draft pull-request delivery primitive. Cycle Nine does not weaken either contract. It adds the missing top-level binding, separate IRIS review, governed merge, canonical-main equality, rollback, cleanup, and zero-resource completion chain.

## Verification

Contract tests must cover exact success ordering and denial or failure for:

- altered, consumed, or expired Founder approval;
- non-IRIS, non-deployed, fixture, or model-mismatched execution;
- local, remote, provider, or Command Center base drift;
- non-independent review or changed review commit;
- checkpoint, target, pull-request, merge-head, or canonical-main inequality;
- incorrect rollback command or missing recoverability;
- cleanup or provider-zero failure; and
- any attempt to treat local tests as the final Phase 0 graduation.

The full `pnpm verify` suite remains required. Passing tests prove machinery readiness only.
