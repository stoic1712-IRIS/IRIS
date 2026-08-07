# Cycle Eleven Live Complete-Delivery Adapter

**Status:** Founder-approved design for implementation

## Purpose

Activate the already canonical `CompleteSoftwareDeliveryRuntime` with a real,
replaceable local adapter so a restricted Founder Full-access session can carry
an ordinary repository objective from inspection through a verified pull request
and disposable-workspace cleanup. The runtime remains owned by IRIS Core. The
Founder Command Center provides only the loopback transport, local provider
bindings, and truthful presentation.

The adapter implements this existing lifecycle without removing or
reclassifying any earlier Phase 0, wave, release, or cycle capability:

`inspect -> plan -> workspace -> implement -> verify -> independent review -> repair -> commit -> non-force push -> pull request -> CI observation -> review-state check -> merge preparation -> remote equality -> cleanup -> exact merge statement`

It never executes the merge. The separately bound merge statement remains a
protected Founder decision. The task's ordinary `merge` completion action
applies only to publishing this adapter implementation, never to a repository
delivery performed by the running adapter. Final Phase 0 graduation remains a
different workflow in which Codex and Claude are audit-only.

## Considered approaches

1. **Core runtime plus injected local adapter — selected.** Reuse the canonical
   Core state machine and capability checks while implementing replaceable Git,
   model, verification, and GitHub provider bindings beside the loopback gateway.
   This keeps authority in Core and avoids duplicating lifecycle semantics.
2. **Command Center-owned delivery state machine — rejected.** Faster initially,
   but it would duplicate Core authority, invite state drift, and violate the
   repository ownership split.
3. **One opaque external delivery script — rejected.** Strong process isolation,
   but insufficiently inspectable and difficult to resume, test, and reconcile
   at individual provider-effect boundaries.

## Architecture

### Core authority

The adapter consumes `CompleteSoftwareDeliveryRuntime`,
`CompleteDeliveryObjective`, and the active `FounderAccessRegistry` grant. Core
reauthorizes each ordinary capability immediately before its provider effect.
The Command Center cannot invent capabilities, approval semantics, terminal
state, or completion evidence.

### Local provider adapter

The adapter is dependency-injected and has four replaceable boundaries:

- a shell-free process runner for exact Git, verification, and GitHub CLI calls;
- a local model client using `qwen3-coder:30b` for bounded implementation and
  repair and `gpt-oss:20b` for independent review;
- a deterministic disposable-worktree controller; and
- an owner/repository allowlist bound to explicit canonical paths and remotes.

Model output is untrusted data. Every path, operation, byte count, model
identity, command, repository, revision, branch, pull-request head, and remote
commit is validated outside the model before an effect occurs.

### Founder interface

Software-delivery launch requires an objective plus explicit repository,
read-path, write-path, and verification-command boundaries. Restricted Full
access is expiring and revocable. The interface displays the live lifecycle,
evidence, pull request, remote equality, cleanup state, and exact Core-authored
merge statement. It has no merge-submission method.

## Security and failure behavior

- Bind only to `127.0.0.1` and the authenticated Founder session.
- Use the existing operating-system keyring-backed GitHub CLI session without
  reading, returning, logging, persisting, or forwarding the raw credential.
- Use no force push, history rewrite, repository administration, deployment,
  spending, paid provider, public/LAN listener, or destructive cleanup.
- Reject dirty or revision-mismatched canonical checkouts before workspace
  creation.
- Create a unique bounded `iris/delivery-*` branch in a disposable worktree.
- Stage only validated changed paths and reject changes outside the exact write
  boundary.
- Execute only the exact command arrays in the objective with bounded time and
  output.
- Reconcile commit, push, and pull-request idempotency keys before repeating an
  external mutation.
- Treat absent CI as `no-checks-configured`, not as evidence that checks ran.
- Stop in `recovery-ready` after failed verification, review, CI, provider
  mismatch, remote inequality, or unverified cleanup.
- Preserve session and event evidence locally without storing model reasoning or
  secrets.

## Acceptance

1. Focused tests first fail while the adapter is unavailable.
2. Exact-path and command validation, model separation, no-force push,
   idempotency reconciliation, pull-request head binding, CI state, review
   state, remote equality, cancellation, expiry/revocation, and cleanup pass.
3. Command Center format, lint, typecheck, test, and build all pass.
4. A disposable held-out repository proof reaches
   `ready-for-merge-approval` through the real adapter with no protected effect.
5. The merged product truthfully reports an active provider adapter only when
   its preflight succeeds.
6. A later real Founder objective may create a normal pull request, but merging
   it still requires the separate exact statement presented by Core.
