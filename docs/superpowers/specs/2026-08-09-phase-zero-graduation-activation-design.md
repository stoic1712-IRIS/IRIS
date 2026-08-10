# Phase 0 Graduation Proposal and Activation Design

**Status:** Founder approved for implementation, verification, publication, and merge on 2026-08-09

## Objective

Close the production gap between the existing Phase 0 graduation contracts and a real Founder-operated graduation run. IRIS Core must prepare the exact proposal from canonical repository evidence with a real loopback model, own the proposal digest and durable approval ledger, accept only authenticated exact typed approvals, and activate the existing `PhaseZeroGraduationRuntime`. The Founder Command Center remains a relay and presentation surface.

This change prepares and activates the graduation machinery. It does not approve or execute the resulting proposal during Codex implementation. Once the Founder later activates the exact proposal, Codex and Claude are audit-only.

## Authority and ownership

- IRIS Core owns proposal construction, proposal digest, state, approval consumption, execution, evidence, and conclusion.
- The Command Center requests proposal preparation, renders strictly validated Core state, and forwards exact Founder statements from an authenticated loopback session.
- The model receives bounded canonical evidence and never receives credentials or authority.
- The final graduation proposal binds `codexMutation: false` and `claudeMutation: false`.
- Ordinary Founder Full access does not substitute for either the initial graduation approval or the later merge approval.

## Production flow

1. The Founder supplies a bounded self-upgrade objective on the Graduation surface.
2. The Command Center forwards the request over the existing signed loopback boundary with a distinct proposal scope.
3. Core verifies clean and equal canonical repositories, gathers bounded Git evidence, and asks a real local Ollama model to select safe multi-file read/write paths and exact verification commands.
4. Core validates the model output, constructs the nested executable-worker proposal, computes the Core-owned digest, persists an atomic `presented` envelope outside Git, and returns the exact typed approval statement.
5. The Founder may later type that exact statement. Core durably consumes it once and starts `PhaseZeroGraduationRuntime` with the live adapter.
6. IRIS creates the real-model candidate in a disposable workspace, independently reviews the exact candidate, checkpoints it privately before public delivery, and presents a second exact merge approval.
7. Only after that second Founder approval may IRIS merge, synchronize, preserve rollback evidence, clean workspaces, terminate scoped resources, and verify provider-authoritative zero resources.

## Durable coordinator

The coordinator stores one versioned record in an operator-state directory outside the canonical repository. Writes use a temporary sibling and atomic rename. The record contains only validated proposal, envelope, approval receipts, and result evidence; it contains no raw credential. Replayed or mismatched proposal and approval identifiers fail closed. A process restart never re-consumes an approval silently.

The coordinator implements both the transport store and the graduation adapter boundary. It delegates live Git, model, review, delivery, and provider operations to a production adapter while retaining approval and merge-approval ownership.

## Live adapter

The live adapter reuses existing IRIS components:

- `GitCandidateWorkspaceAdapter`, `ExecutableWorkerRuntime`, and a real Ollama coding agent for the candidate;
- a distinct local reviewer model plus the exact verification commands for independent review;
- `GithubCliRepositoryProvider` and OS-keyring-backed GitHub CLI authentication for non-force checkpoint, branch, pull-request, and exact-head merge operations;
- Git ancestry and remote/provider queries for canonical equality and rollback evidence.

No secret value is read into model context. No force push, history rewrite, administrator bypass, spending, deployment, public/LAN listener, or unrelated repository change is available.

## Strict transport additions

- `POST /v1/graduation-proposals` on Core: signed body-bound proposal scope.
- `POST /v1/graduation/proposals` on the Command Center: authenticated same-origin + CSRF request relayed to Core.
- Existing readiness and approval routes continue unchanged in meaning.
- Proposal requests are idempotent only for the exact active objective. A second active or expired workflow must be explicitly resolved; it is never overwritten silently.

## Failure behavior

- Unavailable model, dirty or unequal canonical state, stale base, invalid model output, unsafe path, unknown command, replay, receipt mismatch, or provider mismatch returns unavailable and performs no mutation.
- Candidate or review failure concludes with hash-linked evidence and no merge.
- Unknown approval-consumption state blocks replay.
- Failed cleanup or provider-zero verification prevents a graduation-success claim.

## Verification

Tests must prove strict proposal construction from real-model-shaped output, canonical evidence binding, atomic durable state, proposal and approval replay denial, authenticated route separation, runtime activation exactly once, fail-closed restart behavior, Command Center relay-only ownership, and no automatic approval or execution during smoke testing. Full repository verification and an independent exact-head review are required before merge.

## Historical description correction

The old Wave 10 checkpoint remains preserved as historical machinery evidence. The technology registry must stop describing it as permanent deployed Phase 0 graduation, because the current Constitution and Founder mandate require the genuine Founder-operated multi-file self-upgrade described above.
