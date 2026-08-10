# Phase 0 Graduation Proposal and Activation

**Status:** Implemented and verified; final IRIS proposal not yet approved or executed

**Owner:** IRIS Core

**Transport:** loopback-only signed HTTP

**Proposal model:** real local `qwen3-coder:30b` through Ollama

## Purpose

This contract closes the missing path between the existing Phase 0 graduation controller and the Founder Command Center. It lets deployed IRIS inspect exact canonical repository evidence, ask a real local coding model for a bounded multi-file self-upgrade plan, create and durably store a strict digest-bound Core proposal, present the exact approval statement, consume one authenticated Founder approval, and activate the existing graduation controller exactly once.

Implementing this path does not complete Phase 0. Completion requires IRIS itself to execute the separately approved proposal and produce the full canonical evidence chain while Codex and Claude remain audit-only.

## Authority boundary

- IRIS Core owns proposal construction, proposal digest, durable state, approval consumption, execution, merge rendezvous, evidence, and final conclusion.
- The Founder Command Center is a same-origin authenticated relay and renderer. It keeps no graduation truth and cannot create approval authority.
- Codex and Claude may implement and review this activation path, but may not approve or execute the resulting graduation proposal.
- Once the Founder activates that proposal, Codex and Claude are audit-only for the graduation workflow.

## Proposal construction

`POST /v1/graduation-proposals` requires the signed scope `phase-zero-graduation:propose:v1` and a strict body containing only a bounded objective. Core then:

1. verifies clean `main` and exact `HEAD == origin/main` in Core and Command Center;
2. reads bounded tracked content from the exact canonical Core revision;
3. creates an evidence digest without exposing workstation paths;
4. calls loopback Ollama with fixed model `qwen3-coder:30b`, temperature zero, a strict JSON schema, and bounded context; every write path must also be inspected, and one invalid response receives one bounded corrective retry without weakening validation;
5. rejects protected or unsafe paths and non-allowlisted verification commands;
6. nests the model plan inside the existing executable-worker proposal contract;
7. binds the complete Phase 0 proposal to the canonical Core digest and writes it atomically outside Git.

The model selects no credentials, provider administration, governance, registry, lockfile, coordination, GitHub workflow, or history-control path.

## Founder approval and activation

The Command Center shows Core's exact proposal ID, digest, scope, and approval statement. It submits only the exact statement entered by an authenticated Founder session. Core verifies the signed request, exact proposal binding, expiry, one-time status, durable ledger receipt, and current canonical revision before starting the existing controller in the background.

The initial approval does not silently authorize the later merge. When independent review and delivery produce an exact commit and pull request, Core pauses and publishes a second exact merge-approval statement. Only a separately authenticated exact merge approval may resume the controller.

## Execution contract

After Founder activation, the existing controller performs:

- canonical/provider/model/zero-resource preflight;
- disposable-worktree real-model implementation;
- focused and full verification with bounded repair;
- distinct real-model independent review;
- checkpoint-first non-force publication;
- target branch push and draft pull request;
- exact-head merge after the second Founder approval;
- canonical remote equality and history-preserving rollback evidence;
- workspace cleanup, paid-resource termination, and provider-authoritative zero-resource verification.

Any mismatch, expiry, missing provider capability, unauthorized path, failed check, missing receipt, or canonical drift fails closed.

## Persistence and recovery

The coordinator persists one strict versioned record by atomic replacement under the local IRIS state directory, outside the repository. It includes the proposal, presentation envelope, and one-time approval receipts. Restarting the HTTP service does not recreate or broaden approval. A concluded record remains inspectable; a consumed approval cannot be replayed.

## Acceptance boundary

Implementation acceptance requires all focused and full Core and Command Center verification to pass, exact-path review, non-force publication, merged remote equality, synchronized local `main`, runtime restart, and a live real-model smoke test that stops with an unapproved proposal displayed. No implementation smoke test may submit the statement or activate execution.
