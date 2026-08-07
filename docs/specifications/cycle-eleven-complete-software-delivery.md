# Cycle Eleven Complete Software Delivery

**Status:** Implemented additive Core composition; protected merge remains separately authorized

## Purpose

Compose IRIS's existing executable-worker, repository, review, and GitHub-provider machinery into one resumable ordinary engineering lifecycle:

`objective -> inspect -> plan -> disposable workspace -> implement -> verify -> independent review -> repair -> commit -> non-force branch push -> pull request -> CI monitoring -> review reconciliation -> merge preparation -> remote branch equality -> cleanup`

## Authority and scope

The runtime accepts only a strict objective bound to an active Founder access request, repository, base revision, branch, read/write paths, exact verification commands, zero-dollar budget, change limits, repair limit, and expiry. Before starting or resuming, it checks every required ordinary capability through the injected access authorizer.

All repository and provider effects are injected adapters. The runtime cannot invent a broader path, self-review, silently accept a changed pull-request head, continue after failed CI, skip remote equality, or claim cleanup without evidence. A reviewer identity equal to the worker identity is denied.

## Repair, recovery, and completion

Verification or review findings may trigger bounded repair. Exhaustion, scope violations, provider mismatch, CI failure, or cleanup failure preserve a `recovery-ready` session when a workspace exists. Cancellation attempts cleanup and records the outcome. Pause and resume preserve the digest-chained event record and unchanged grant.

Successful ordinary delivery ends at `ready-for-merge-approval`. The runtime presents the provider-bound merge statement but does not merge. Deployment, secrets, spending, repository administration, force-push, history rewrite, and destructive operations remain outside this contract.
