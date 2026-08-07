# Cycle Eleven Complete Software Delivery

**Status:** Implemented additive Core composition; protected merge remains separately authorized

## Purpose

Compose IRIS's existing executable-worker, repository, review, and GitHub-provider machinery into one resumable ordinary engineering lifecycle:

`objective -> inspect -> plan -> disposable workspace -> implement -> verify -> independent review -> repair -> commit -> non-force branch push -> pull request -> CI monitoring -> review reconciliation -> merge preparation -> remote branch equality -> cleanup`

## Authority and scope

The runtime accepts only a strict objective bound to an active Founder access request, repository, base revision, branch, read/write paths, exact verification commands, zero-dollar budget, change limits, repair limit, and expiry. It checks every required ordinary capability before starting or resuming and reauthorizes the exact capability immediately before every adapter effect, so expiry or revocation stops the next effect.

All repository and provider effects are injected adapters. The runtime cannot invent a broader path, self-review, silently accept a changed pull-request head, continue after failed CI, skip remote equality, or claim cleanup without evidence. Verification evidence must list the exact command arrays in the objective. Initial implementation and every repair return the complete changed-path and byte evidence, which is revalidated against the same scope and limits before continuing. A reviewer identity equal to the worker identity is denied.

## Repair, recovery, and completion

Verification or review findings may trigger bounded repair. Exhaustion, scope violations, provider mismatch, CI failure, or cleanup failure preserve a `recovery-ready` session when a workspace exists. Durable milestones bind the plan, workspace, candidate commit, pushed commit, and pull request. Before commit, push, or pull-request creation, the runtime persists a deterministic repository-and-objective-bound idempotency key; adapters must reconcile repeated calls carrying that key rather than create a duplicate external mutation. Resume therefore continues from the last durable milestone and safely reconciles the narrow crash window after an external effect but before its result is saved. Cancellation records terminal state before cleanup, invalidates late results, reauthorizes cleanup, and bounds the cleanup wait. Pause and resume preserve a session-bound, sequence-checked digest event record and the unchanged grant.

Successful ordinary delivery ends at `ready-for-merge-approval`. Core constructs the exact repository, pull-request, and head-commit-bound merge statement itself; adapters cannot supply or weaken it. The runtime does not merge. Deployment, secrets, spending, repository administration, force-push, history rewrite, and destructive operations remain outside this contract.
