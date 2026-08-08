# Qwen Primary Cognitive Orchestration Design

**Status:** Founder-approved design direction; implementation pending

**Date:** 2026-08-08

**Founder selection:** Approach 2 — Qwen 27B orchestrates the existing specialists

**Bound Core base:** `6367e4547d34092472c672ee93a9e1b2a8e5c80f`

**Bound Founder Command Center base:** `edb2f882cc91deff7109491e609b733157c92e5a`

## Objective

Make `qwen3.6:27b` the primary Founder-facing cognitive and communication provider for IRIS while preserving IRIS Core as the permanent owner of identity, canonical memory, governance, approvals, audit, model routing, and worker lifecycle. Qwen receives Founder objectives, creates bounded delegation proposals, evaluates governed specialist results, and communicates the final outcome in one consistent IRIS voice.

The existing specialist pool remains intact:

- `qwen3-coder:30b` for repository implementation, debugging, repair, and other coding work;
- `gpt-oss:20b` for deep reasoning, research review, and independent software review;
- `qwen3:8b` for fast low-complexity work and a clearly disclosed degraded dialogue fallback; and
- registered deterministic, research, browser, desktop, connector, repository, and delivery workers for governed tool execution.

No model becomes IRIS's identity, authority, memory owner, or policy engine. Every model remains a replaceable provider behind IRIS-owned contracts.

## Source and Canonical Alignment

This design implements, without superseding:

- the Constitution's requirement that IRIS Core own consistent system voice and model-routing policy while models remain replaceable reasoning engines;
- the Worker Reasoning Framework's identity hierarchy, bounded delegation, minimum relevant context, independent verification, and one-voice communication standard;
- ADR-003's replaceable model-runtime boundary;
- the Governing Architecture's specialized model pool, primary 20B–30B reasoning/general role, delegation workflow, and final presentation in one consistent IRIS voice;
- the current model router in `packages/model-gateway/src/model-router.ts`; and
- the current Founder Command Center model and worker adapters.

The six files in `C:\Projects\STOIC-IRIS-source-library` were verified against `SOURCE-MANIFEST.md` before this design was written. All SHA-256 bindings matched.

This design is additive. It does not remove, rename, weaken, reclassify, or replace any Wave 0–12, Phase 0, release, development-cycle, worker, tool, approval, Full-access, self-repair, delivery, certification, or rollback capability.

## Approaches Considered

### Approach 1: Route every request directly to Qwen 27B

This would simplify the visible model path but would discard the quality and independent-verification advantages of the approved specialist pool. It is rejected.

### Approach 2: Qwen 27B coordinates the existing specialist pool

Qwen remains the continuous Founder-facing provider. IRIS validates Qwen's structured delegation proposal, runs the selected specialist and independent reviewer through existing contracts, and returns the evidence to Qwen for final synthesis. This is the selected design.

### Approach 3: Adopt a separate orchestration application

An external orchestrator would add another state owner, provider boundary, runtime, and failure surface without evidence that the current IRIS-owned orchestration contracts are insufficient. It is rejected for this objective.

## Ownership Boundaries

### IRIS Core owns permanently

- cognitive identity and voice profile;
- canonical and scoped memory assembly;
- objective, goal, task, and operational state;
- delegation and model-routing contracts;
- authority, approvals, risk, protected effects, and Full-access state;
- capability, model, worker, and provider registries;
- audit, evidence, review, rollback, recovery, and cleanup state; and
- the canonical record of what was requested, executed, verified, and learned.

### Qwen 27B provides replaceably

- natural Founder conversation;
- objective interpretation within supplied canonical constraints;
- structured task decomposition and delegation proposals;
- plan and specialist-result synthesis;
- correction-aware steering and explanation; and
- the final natural-language IRIS response when the primary provider is healthy.

Qwen may propose a route or action but cannot grant authority, alter a scope, consume an approval, execute a tool, write canonical memory, or declare completion. IRIS-owned deterministic validation remains authoritative.

### Specialists provide replaceably

Each specialist receives only its task-scoped context, authority, inputs, tools, resource limits, output schema, and success criteria. A specialist cannot communicate a material result as the final IRIS judgment without the coordinator path, approve itself, expand scope, or write canonical memory directly.

## Architecture

The current `ModelRoute` remains the specialist-selection contract so existing worker, coding, research, and review flows remain compatible. A new additive cognitive-turn contract wraps it rather than redefining it.

The cognitive-turn contract records at least:

- the exact Founder turn and active IRIS session identifiers;
- `orchestratorModel`, fixed initially to `qwen3.6:27b`;
- `mode`: `direct` or `delegated`;
- bounded objective and applicable canonical constraints;
- proposed capabilities and specialist route when delegated;
- required authority and protected-effect stop state;
- specialist, reviewer, and presentation states;
- immutable result, evidence, citation, and digest references;
- fallback and recovery state; and
- timestamps, model provenance, and audit correlation identifiers.

The Qwen-produced delegation envelope is untrusted provider output. IRIS validates it against registered capabilities, active authority, allowed repositories and paths, provider availability, resource limits, and required review before any worker runs.

## Turn Data Flow

1. The Founder sends one objective through the authenticated Command Center session.
2. IRIS Core assembles the minimum relevant identity, conversation, memory, project, governance, capability, and current-state context.
3. Qwen 27B returns either a bounded direct-answer envelope or a structured delegation proposal.
4. IRIS validates the envelope. A rejected proposal becomes an exact capability, authority, or contract error; it does not execute.
5. Direct R0 dialogue returns through Qwen without a specialist.
6. Delegated work enters the existing goal, worker, research, executable-worker, complete-delivery, browser, desktop, or connector contract appropriate to the capability.
7. Material coding, research, and deep-reasoning work receives deterministic verification and a distinct reviewer model whenever the canonical policy requires one.
8. IRIS stores immutable validated specialist and reviewer artifacts before presentation.
9. Qwen receives only the minimum validated result and evidence references needed to assess and explain the outcome.
10. Qwen returns the Founder-facing synthesis. IRIS validates the response, preserves exact identifiers and citations, and records model provenance.
11. Durable learning remains a governed memory or registry proposal; conversation never writes canonical memory silently.

## Evidence Integrity

Qwen's final synthesis is a presentation layer, not a mutation layer. Exact code patches, command results, exit codes, URLs, citations, approval statements, proposal digests, commit identifiers, review findings, and rollback evidence remain immutable referenced artifacts.

For fields that must remain exact, the final response is assembled from validated structured fields rather than allowing Qwen to reproduce them from memory. Citation validation continues to require complete source URLs copied from retained evidence. A synthesis that changes or omits a required exact field fails validation and receives one bounded repair attempt before IRIS reports the exact failure.

## GPU and Model Lifecycle

The RTX 3090 has 24 GB of VRAM and is not assumed to hold the primary 27B provider and a 20B–30B specialist concurrently at useful context sizes. Large-model work therefore uses an IRIS-owned sequential lease scheduler:

1. Qwen records the validated cognitive-turn and delegation checkpoint.
2. IRIS publishes a Founder-visible transition state.
3. IRIS unloads or releases the primary model when measured headroom requires it.
4. The specialist receives an exclusive bounded lease, executes, and releases resources.
5. A distinct reviewer receives a lease when required.
6. Qwen reloads, consumes the validated result package, and produces the final synthesis.
7. IRIS verifies that the expected model resources were released or retained according to the active lifecycle policy.

The interface remains responsive through deterministic runtime events; it does not require a second large model to fabricate status messages. Expected visible states include `IRIS planning`, `specialist loading`, `specialist working`, `verification running`, `independent review`, `IRIS synthesizing`, `completed`, `paused`, `cancelled`, and `recovery required`.

Ollama remains the initial headless runtime. Model load, unload, cancellation, timeout, keep-alive, context size, and resource evidence remain behind the existing IRIS-owned adapter. This design adds no model, dependency, paid service, credential, deployment, public exposure, or LAN exposure.

## Failure, Interruption, and Recovery

- If Qwen is unavailable before planning, IRIS preserves the objective and may offer `qwen3:8b` only as a clearly labeled degraded R0 interface. It does not silently impersonate the primary provider.
- If a specialist is unavailable, IRIS retains the plan and reports the exact missing model, provider, tool, or capability. Material work does not silently fall back to an unsuitable model.
- If a specialist fails, IRIS preserves partial evidence, releases resources, and returns the failure to Qwen for bounded explanation or a governed repair proposal.
- If independent review is required but unavailable, completion stops at `reviewer-model-unavailable`.
- If Qwen synthesis fails after valid specialist work, IRIS preserves the validated result and exposes it in a clearly marked evidence view without claiming final IRIS judgment. The turn remains resumable.
- Founder pause, cancel, steering, logout, access revocation, gateway restart, and Windows restart retain their existing authority semantics. New model calls stop as soon as safely possible, and durable governed work resumes only from an authenticated checkpoint.
- A model transition cannot erase conversation, task, worker, approval, review, or evidence state because those remain IRIS-owned.

## Founder Command Center Experience

The Founder communicates only with IRIS. Specialist identities and provenance remain inspectable but do not fragment the conversation.

The Command Center will show:

- the current IRIS cognitive state;
- selected specialist and reason;
- model loading, working, reviewing, and synthesis progress;
- elapsed time, bounded scope, active authority, cancellation, pause, and steering controls;
- raw validated evidence and reviewer findings in expandable views; and
- the final Qwen-authored IRIS explanation linked to its immutable evidence.

The conversation thread remains bounded within its existing scroll region and persists according to the active IRIS conversation contract. Navigating between Command Center views must not erase the session conversation or active objective.

## Compatibility and Migration

- Preserve `routeIrisModel` and the current `ModelRoute` schema for specialist selection.
- Add the cognitive-turn contract and coordinator without changing existing worker output schemas.
- Migrate Founder dialogue to the coordinator path first; direct worker and provider endpoints remain governed compatibility paths until their consumers use the coordinator.
- Preserve explicit Founder model overrides, but interpret them within the cognitive contract: an override selects the requested specialist or response provider without transferring IRIS ownership or authority.
- Preserve all current fallback, independent-review, citation, sensitive-output, approval, session, and tool-evidence validation.
- Do not add GODEL or another provider in this tranche. A later equal-context benchmark may evaluate it as a replaceable dialogue specialist without changing this architecture.

## Security and Authority

This design does not expand Full access or any task authority. Qwen and every specialist remain unable to:

- disclose or resolve credentials;
- spend or enable paid usage;
- deploy or create public/LAN exposure;
- administer accounts, repositories, organizations, rulesets, billing, secrets, or variables;
- force-push, rewrite history, broadly delete, destructively mutate data, or elevate operating-system authority; or
- execute or claim the final Phase 0 graduation without the separate exact workflow.

Prompt, repository, browser, research, and specialist content remain untrusted data. No model output can change the governing prompt, active task, authority, scope, or required verification.

## Implementation Boundaries

### IRIS Core tranche

- define the cognitive-turn, delegation, state, result, and evidence-reference schemas;
- implement deterministic validation around Qwen delegation proposals;
- bind the existing model router as the specialist selector;
- add model-lease scheduling and transition events behind provider-independent contracts;
- preserve exact-artifact and independent-review rules; and
- add unit, contract, security, fallback, cancellation, recovery, and compatibility tests.

### Founder Command Center tranche

- consume the merged Core cognitive contract;
- route Founder dialogue through Qwen orchestration rather than direct specialist presentation;
- execute validated specialist and reviewer steps through existing adapters;
- return validated result packages to Qwen for final synthesis;
- render live model and worker transitions with pause, cancel, and steering; and
- add integration and local acceptance tests against actual approved Ollama models.

The Core tranche must merge first. The Command Center task binds the exact merged Core revision so that the UI cannot invent orchestration semantics.

## Verification Strategy

### Deterministic tests

- ordinary dialogue uses Qwen 27B and no specialist;
- coding work delegates to Qwen Coder and obtains distinct GPT-OSS review;
- deep reasoning and research delegate to the approved specialist and return through Qwen;
- exact URLs, citations, hashes, approval statements, command results, and review findings survive synthesis unchanged;
- an unregistered capability, altered scope, unavailable reviewer, protected effect, or malformed delegation fails closed;
- explicit Founder overrides remain bounded and auditable;
- specialist, reviewer, and Qwen failures preserve resumable state and evidence;
- cancellation during every model phase prevents later calls and cleans bounded resources;
- existing router and worker contract tests remain passing; and
- no existing capability disappears from the registry or Command Center tree.

### Local model acceptance

Run representative conversation, coding, research, review, interruption, and recovery turns through the actual loopback Founder runtime. Record model provenance, route, transition events, elapsed time, output validation, VRAM/process state, and cleanup. The acceptance run must demonstrate sequential operation on the RTX 3090 rather than assume concurrent residency.

### Full verification

Run the narrowest new tests first, then the full applicable verification suite in each repository. Any skipped, flaky, unavailable, or environment-dependent check remains a limitation rather than a pass.

## Acceptance Criteria

The design is implemented only when all of the following are proven:

1. Qwen 27B is the normal Founder-facing cognitive and communication provider.
2. Existing specialist models and workers remain available and are selected through validated IRIS contracts.
3. Material specialist results receive required independent review before final completion.
4. Every specialist result returns through Qwen for final IRIS evaluation and explanation when the primary provider is healthy.
5. Exact evidence remains unchanged and independently inspectable.
6. The Founder sees live, accurate progress during sequential model transitions.
7. Pause, cancel, steering, failure, restart, and resume preserve bounded state and authority.
8. Provider replacement does not change IRIS identity, memory, governance, approvals, or audit ownership.
9. No existing capability, restriction, rollback route, or Phase 0 artifact is removed or weakened.
10. Focused and full verification pass in both repositories, followed by a real local Ollama acceptance run and resource-cleanup evidence.

## Rollback

Disable the cognitive coordinator and restore the existing direct model-routing presentation path through a history-preserving revert or feature flag. Existing specialist routes, workers, schemas, and evidence remain available because the design extends rather than replaces them. Verify ordinary dialogue, coding, research, review, cancellation, and cleanup after rollback.

## Explicit Non-Claims

This design does not claim implementation, deployment, model superiority, permanent Phase 0 graduation, unrestricted autonomy, concurrent large-model residency, canonical-memory learning from conversation, or provider-authoritative zero resources. Those claims require their own implementation and evidence gates.
