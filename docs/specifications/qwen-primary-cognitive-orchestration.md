# Qwen Primary Cognitive Orchestration

**Status:** Locally implemented Core contract; independent review and publication pending  
**Version:** 1.0.0  
**Date:** 2026-08-08  
**Owner:** IRIS Core

## Purpose

This additive contract makes `qwen3.6:27b` the primary local IRIS dialogue and cognitive
orchestrator while preserving the existing specialist router. IRIS Core remains the sole owner of
identity, objectives, policy, authority, evidence binding, state transitions, and Founder-facing
completion truth. A model proposes typed outputs; it never becomes an authority or memory owner.

## Model roles

- `qwen3.6:27b`: normal Founder dialogue, planning, vision, delegation, and final synthesis.
- `qwen3-coder:30b`: bounded software-engineering specialist selected by the existing router.
- `gpt-oss:20b`: research/deep-reasoning specialist and required independent coding reviewer.
- `qwen3:8b`: clearly disclosed R0-only degraded dialogue when the primary model is unavailable.

The existing `routeIrisModel` behavior and explicit allowlisted Founder overrides remain intact.
Overrides change only the selected route; they do not change the objective, repository/path scope,
capabilities, risk, review obligation, or authority.

## Strict contracts and validation order

Every boundary uses strict Zod schemas. Requests bind the request/session/correlation identifiers,
objective identifier and digest, utterance, risk, exact repository/path scope, approved available
models, image status, and timestamp. Delegation, specialist, review, synthesis, presentation,
transition, lease, and durable snapshot envelopes reject unknown fields.

IRIS validates in this order:

1. Parse the Founder request and delegation policy.
2. Persist `accepted` before any model call.
3. Calculate the authoritative route from the original request and approved available models.
4. Validate Qwen's objective digest, route purpose, capabilities, protected-stop state, and
   authority-free delegation.
5. Validate specialist objective/route bindings and exact artifact digest.
6. Require a distinct reviewer and validate reviewer/artifact bindings.
7. Validate synthesis and exact evidence acknowledgements.
8. Derive completion from validated Core state, never from model prose.

## Sequential model leases

`ModelLeaseScheduler` permits one acquisition at a time. It records metadata-only acquisition,
cancellation, release-request, release, and release-failure events. Release is attempted in
`finally` after success, failure, or cancellation. A provider-confirmed release is required before
the next model lease. Release failure is recorded truthfully and returns a safe, retryable failure
code; raw provider errors are not exposed.

This design supports the workstation's bounded GPU memory without changing Ollama transport or
installing a model. Provider loading/unloading remains an injected adapter responsibility.

## Direct and delegated turns

Ordinary conversation and vision may complete directly through Qwen 27B. Material coding,
research, and deep-reasoning work is delegated once to the routed specialist, independently
reviewed, and returned to Qwen 27B for Founder-facing synthesis. Healthy fast-response routing may
use Qwen 8B only as a delegated specialist; it does not replace Qwen 27B's final judgment.

Transitions are one-based, request/correlation-bound, SHA-256 linked, persisted before emission,
and visible through the injected transition sink. Tests use only in-memory adapters and do not call
Ollama, Git, the filesystem, or the network.

## Exact evidence and synthesis repair

Required evidence is de-duplicated by `evidenceId`. Conflicting content under one identifier fails
closed. Qwen receives evidence descriptors and must acknowledge required identifiers, but the
Founder presentation attaches the original validated evidence objects byte-for-byte. Qwen never
reconstructs citations, command results, approvals, digests, reviews, or rollback values.

One repair attempt is allowed only for invalid synthesis structure or missing evidence
acknowledgement. A second failure saves `synthesis-failed`, retains the validated specialist and
review artifacts, releases the model lease, and does not fabricate completion.

## Interruption and recovery

Pause and cancellation are persisted before the active lease is aborted. Provider results are
accepted only when the durable generation still matches the captured generation, so a late
non-cooperative worker cannot overwrite terminal cancellation. Steering retains at most ten
secret-redacted notes and cannot widen the stored request or policy.

Resume requires byte-equivalent request and policy bindings. Completed/cancelled states remain
terminal. A durable reviewed artifact resumes at synthesis without repeating specialist or reviewer
calls. Unexpected provider failure saves `recovery-required` with a safe code and keeps prior exact
evidence available.

## Fallback and failure behavior

- Missing Qwen 27B stops material work before specialist execution.
- Qwen 8B degraded mode is limited to direct R0 dialogue/fast response and is visibly labeled.
- Qwen 8B is never final judgment for coding, research, deep reasoning, review, or protected work.
- Coding requires GPT-OSS as the distinct reviewer; absence saves `reviewer-model-unavailable`.
- Missing models never silently weaken the requested purpose or authority boundary.

## Security, authority, and compatibility

All model-produced envelopes have `authority: "none"`. Existing protected effects, approvals,
capability allowlists, secret filtering, router tests, Ollama adapter tests, and Founder-dialogue
tests remain active. This tranche adds no dependency, model download, credential, provider resource,
deployment, public/LAN exposure, spending, repository write authority, or destructive operation.

Rollback is history-preserving: revert the local feature commits or omit them from publication.
Existing router and adapter exports are not removed.

## Non-claims and later binding

This local Core implementation does **not** claim live Ollama acceptance, Command Center
integration, deployment, model availability, publication, or Phase 0 Development Independence.
Command Center work must bind to the exact independently reviewed and merged Core revision in a
separate approved coordination task. The permanent Phase 0 gate still requires a genuine deployed,
Founder-operated, real-model, canonical-repository self-upgrade while Codex and Claude are
audit-only.
