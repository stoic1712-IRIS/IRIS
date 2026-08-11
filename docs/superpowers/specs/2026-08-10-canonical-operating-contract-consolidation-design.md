# Canonical Operating Contract Consolidation Design

**Status:** Founder-approved design; specification and implementation planning authorized

**Version:** 1.0.0

**Date:** 2026-08-10

**Bound Core baseline:** `f4ae5c9352bf99b070261ebefa784a1b0aa8fdde`

**Bound Founder Command Center baseline:** `0e6731a80589ca6539cbeccfa3a3e5e7ec8c4663`

## Objective

Give IRIS, Codex, every worker, and the Founder Command Center one validated operating contract that answers the same questions in the same way:

1. What is the current objective?
2. Which actor owns identity, policy, authority, execution, evidence, and presentation?
3. Which capabilities and providers are actually available now?
4. Which ordinary capability may execute under the active Founder access grant?
5. Which protected effect needs an exact Founder approval?
6. Which missing capability must be acquired or repaired?
7. What evidence proves completion, failure, rollback, cleanup, and remote equality?

The desired steady state is action-first and low-friction. IRIS does not answer an actionable request with a generic refusal when a registered route, a capability-acquisition route, or a bounded repair route exists.

## Selected Approach

Use one canonical, versioned, machine-readable operating contract as the sole runtime decision source. Keep implementation modules, tests, evidence, and historical governance documents focused and modular. Generate human-readable summaries and UI views from the contract; do not manually duplicate its rules.

The selected approach rejects both extremes:

- **One literal code file:** rejected because it would couple unrelated subsystems, increase merge conflicts, and make review, testing, and replacement unsafe.
- **A human-only summary document:** rejected because prose cannot fail closed, drive runtime routing, or prevent UI and model prompts from drifting.
- **One validated contract with modular consumers:** selected because it provides one operating truth without destroying maintainability or historical evidence.

## Non-Goals

- Do not erase the Build Bible, Governing Architecture, Canonical Development Roadmap, Constitution, ADRs, governance history, approval evidence, tests, commits, releases, or completed wave/cycle records.
- Do not collapse all source code into one file.
- Do not make a model provider the owner of IRIS identity, policy, memory, authority, or completion truth.
- Do not silently grant credentials, spending, destructive data operations, public/LAN exposure, account or repository administration, force-push, history rewriting, deployment, or Phase 0 graduation.
- Do not claim Phase 0 Development Independence until IRIS completes the separately defined real canonical self-upgrade while Codex and Claude remain audit-only.
- Do not add a paid service, dependency, credential, model, deployment, public port, or LAN port in this consolidation.

## Canonical Artifact

The authored contract lives at:

`config/iris-operating-contract.v1.json`

It is the only manually maintained operating-rule artifact. It contains:

- contract identity, semantic version, source bindings, and digest policy;
- authority precedence and actor ownership;
- ordinary capabilities and protected effects;
- provider requirements and live-evidence requirements;
- Founder access lifecycle;
- deterministic decision outcomes;
- capability-gap and acquisition behavior;
- model-routing and exact-evidence rules;
- required verification, review, rollback, cleanup, and reporting;
- Command Center presentation rules; and
- retirement aliases for legacy wording and routes during migration.

`packages/contracts/src/operating-contract.ts` owns its strict schema and type. `scripts/contracts/compile-operating-contract.mjs` parses, canonicalizes, hashes, and writes the generated runtime artifact:

`generated/iris-operating-contract.compiled.json`

The generated artifact contains the validated contract plus `contractDigest`. It is never hand-edited. A checked-in generated artifact makes runtime startup deterministic and lets both repositories bind an exact contract digest without parsing governance prose.

The Core package exports the schema, compiled-contract loader, and digest verifier. Root `AGENTS.md`, the Command Center gateway, IRIS model context assembly, worker task assembly, the capability tree, and developer tooling point to this contract rather than restating its rules.

## Source and Authority Model

The contract consolidates active operating rules without deleting their provenance. Its `sources` array binds the exact canonical files and content digests used to create version 1.0.0.

The decision order remains:

1. current explicit Founder instruction;
2. the validated canonical operating contract;
3. contract-bound canonical governance and architecture sources for details not represented as runtime rules;
4. verified repository, provider, and workstation state;
5. prior conversations and model memory as supporting context only.

If an explicit Founder instruction conflicts with a permanently protected effect, IRIS prepares the smallest exact approval or policy-change proposal; it does not pretend the conflict does not exist. If two canonical sources conflict, startup or the affected objective stops with exact conflicting paths and digests until the contract is replaced.

## Actor and Authority Semantics

The current code uses `authority: "none"` correctly for untrusted model output, but older prompts and consumers sometimes interpret it as if the whole IRIS controller has no execution route. The contract separates these concepts:

- **IRIS Core:** owns identity, policy, registry, approval evaluation, access grants, orchestration, audit, evidence, and completion truth.
- **Founder:** owns objectives, protected approvals, Full-access activation, interruption, revocation, and final acceptance.
- **Model provider:** proposes reasoning, plans, and presentation with `modelAuthority: "none"`.
- **Controller:** executes only capabilities authorized by a validated active grant or exact protected approval.
- **Worker/provider:** performs one bounded task using controller-issued scope and records evidence; it cannot expand scope or approve itself.
- **Command Center:** displays and forwards Core-owned state; it does not invent authority.

Every Founder-facing response includes a controller disposition separate from model authority.

## Deterministic Decision Outcomes

Every actionable request resolves to exactly one `OperatingDecision`:

1. `execute-now` — the capability is registered, healthy, compatible, and authorized; create or resume the bounded objective.
2. `acquire-capability` — a capability or provider is missing; produce the smallest source-bound acquisition proposal and required approval.
3. `request-protected-approval` — the capability exists but the requested external effect is permanently protected; present the exact digest-bound approval.
4. `repair-runtime` — the capability is registered but its provider, contract, or runtime is unhealthy; attempt bounded repair or produce a repair proposal.
5. `report-terminal` — the objective is complete, cancelled, physically impossible, or unsupported after source-backed research; return exact evidence and next alternatives.

Generic `cannot`, `not connected`, `no authority`, and `try commands yourself` responses are forbidden when one of the first four outcomes applies.

## Founder Full Access

Founder Full Access is a controller grant for every registered ordinary capability. It remains:

- authenticated and Founder-initiated;
- bound to the current Founder session and gateway boot;
- visible, auditable, interruptible, and revocable;
- valid until logout, explicit revocation, emergency stop, session invalidation, or gateway replacement; and
- incapable of silently including a protected effect.

An ordinary-capability proposal does not expire merely because a model or verification run takes time. It remains valid until consumed, replaced, revoked, or invalidated by canonical contract/repository drift. Runtime processes may have workload-aware timeouts and resumable checkpoints.

## Capability Acquisition and Self-Repair

When a requested capability is missing, IRIS must state:

- the exact capability identifier;
- the first failed preflight condition;
- evidence for installed, running, compatible, authorized, credential-reference, network, hardware, and protected-effect state;
- whether an existing provider can be repaired or a new provider is required;
- official source, pinned version, digest, license, cost, permissions, and data exposure;
- install, verify, rollback, removal, and registry-update commands; and
- the exact Founder approval required.

Acquisition never becomes permission merely because software exists. Zero-cost, local, registered ordinary capability acquisition may proceed under an active Full-access grant only when the contract explicitly classifies it as ordinary and its exact proposal is approved. Credentials, spending, elevation, deployment, public exposure, and administration remain protected.

IRIS self-repair uses the same decision engine. It operates in a disposable workspace, preserves failure evidence, validates exact paths, runs verification, performs independent review when required, creates a history-preserving checkpoint before canonical delivery, and cleans only after remote equality and rollback evidence exist.

## Runtime Architecture

### Core

Core adds:

- a strict operating-contract schema and compiler;
- a contract loader that validates version, digest, and source bindings at startup;
- a live capability snapshot assembled from registered capabilities, providers, grants, credentials references, workstation evidence, and protected-effect classification;
- an `OperatingDecisionEngine` that returns one deterministic outcome;
- a context assembler that gives models and workers the minimum relevant contract slice rather than many overlapping documents; and
- contract-consistency diagnostics used by CI, `iris-dev`, runtime startup, and evidence records.

### Founder Command Center

The Command Center:

- loads the exact compiled Core contract digest at gateway startup;
- rejects startup on contract/schema/digest mismatch;
- sends Conversation and Command modes through one gateway controller;
- uses client-only logic solely for emergency-stop fallback and view navigation;
- derives the capability tree from the live contract snapshot;
- renders decision state, active grant, provider health, worker activity, evidence, and next approval;
- preserves conversation and objective state across view navigation; and
- never converts `modelAuthority: "none"` into a controller refusal.

### Model and Worker Context

Models receive a compact `OperatingContextSlice` containing only:

- identity and Founder relationship;
- the current objective and exact scope;
- active controller disposition and grant summary;
- applicable capabilities and protected effects;
- current provider evidence;
- required output schema and exact evidence references; and
- the five decision outcomes.

They do not receive the entire governance library unless a task specifically requires a source. Workers receive only their task-scoped contract slice.

### Codex and Other Development Agents

`iris-dev contract inspect --json` returns the validated contract identity, digest, authority order, applicable repository state, and requested capability slice. Root `AGENTS.md` requires this check before an agent reasons about capability, authority, execution, acquisition, protected effects, cleanup, or completion. The personal `iris-dev` companion skill delegates to this canonical Core command after the Core change merges; it does not maintain a second policy copy.

This gives Codex and future development agents the same current operating truth as IRIS while preserving a crucial boundary: an agent's technical ability or stored memory never creates Founder authority.

## Migration and Retirement

Migration is additive until every consumer is proven to use the new contract.

1. Add and validate the contract without changing behavior.
2. Add the decision engine and compare it against current routes in shadow mode.
3. Migrate Core context assembly, model prompts, and worker task assembly.
4. Migrate Command Center conversation, command, capability, operator, and repair surfaces.
5. Run compatibility tests proving no registered capability disappeared.
6. Generate a retirement inventory containing every duplicate prompt, static capability label, legacy route, stale worktree, temporary candidate, and redundant plan artifact.
7. Classify each item as `keep`, `generated`, `compatibility-alias`, `archive`, or `delete` with references and replacement evidence.
8. Remove only `delete` items with zero live references, zero unique Git state, passing focused tests, and an exact rollback path.

Git history and canonical evidence are never deleted. Dirty or unmerged worktrees are never removed automatically. Cleanup commands use exact paths and no force flags.

## Known Contradictions This Design Resolves

- `founder-dialogue.ts` tells the model it has no execution authority without separately describing controller authority.
- the Command Center conversation schema exposes only `authority: "none"`.
- Command mode uses a local `replyToFounder` fallback instead of the live controller.
- `voice-interface.ts` can claim the live worker runtime is not connected even when ordinary operator routes exist.
- `capability-tree.ts` is a static status snapshot rather than live contract/provider state.
- conversation tooling recognizes only a small subset of registered ordinary capabilities.
- capability diagnosis, acquisition, operator execution, repair, and conversation are separate flows instead of one decision outcome.
- multiple stale worktrees and historical checkouts can look like the active canonical repository.

Model-output authority remains `none`; only the incorrect system-wide interpretation is removed.

## Verification and Acceptance

### Contract tests

- extra fields, unknown capabilities, duplicate identifiers, missing source digests, and invalid versions fail;
- the compiled digest is deterministic across Windows and WSL;
- generated artifacts match the authored contract byte-for-byte after canonicalization;
- every registered ordinary capability appears exactly once;
- every protected effect appears exactly once and never in Full Access;
- every legacy alias resolves to one canonical capability or is explicitly retired.

### Decision tests

- healthy authorized ordinary work resolves to `execute-now`;
- an absent provider resolves to `acquire-capability` with exact evidence;
- a stopped provider resolves to `repair-runtime`;
- protected work resolves to `request-protected-approval`;
- completed and unsupported work resolves to `report-terminal`;
- no actionable test produces a generic refusal;
- models cannot widen scope, grant authority, or alter exact evidence.

### Command Center tests

- Conversation and Command modes use the same live controller;
- capability status derives from live snapshots, not static labels;
- Full Access immediately changes eligible ordinary decisions to `execute-now`;
- protected effects remain protected under Full Access;
- view navigation and refresh restore the active conversation and objective;
- provider outages produce repair/acquisition states rather than false permanent restrictions;
- emergency stop interrupts active work and revokes the active access grant;
- startup fails closed on Core/Command Center contract digest mismatch.

### Cleanup tests

- every proposed removal has zero references and a documented replacement;
- worktree inventory distinguishes canonical, clean disposable, dirty, unmerged, and orphaned filesystem paths;
- cleanup refuses dirty, unmerged, unknown, or broad targets;
- exact rollback instructions restore each removed compatibility alias or generated file.

### Live launch acceptance

1. Launch from the canonical checkouts.
2. Authenticate and enable Founder Full Access.
3. Ask IRIS for runtime, capability, and restriction status; verify it cites live contract/provider evidence.
4. Execute a read-only repository inspection without another approval.
5. Execute a bounded disposable edit, verification, repair, commit-candidate, and cleanup workflow.
6. Request an unavailable capability and verify IRIS creates an acquisition proposal rather than refusing.
7. Request a protected effect and verify IRIS asks for the exact approval without weakening the boundary.
8. Restart the gateway and verify contract validation, conversation/objective recovery, and no false capability loss.
9. Run full verification in both repositories and independent review.
10. Only after these pass may IRIS initiate the separate Founder-approved Phase 0 graduation proposal. During the actual graduation workflow, Codex and Claude are audit-only.

## Completion Evidence

Completion of this consolidation requires:

- exact Core and Command Center commits and remote equality;
- the contract version and digest;
- full verification results for both repositories;
- independent review with no unresolved Critical or Important findings;
- live launch transcript covering every decision outcome;
- capability-registry before/after comparison proving no loss;
- retirement inventory and exact cleanup evidence;
- rollback commands and a private checkpoint where required; and
- a truthful statement that consolidation is complete but Phase 0 remains separately evidence-bound until its real graduation run succeeds.
