# Canonical Operating Contract

**Contract:** `iris.stoic/operating-contract/v1`

**Version:** `1.0.0`

**Compiled digest:** `sha256:cc1812bff1a668062e3fd1ebf374189a40d7d9e83f33bb6e82f637301e8e5ea9`

## Purpose

The Canonical Operating Contract is the single machine-readable runtime decision source for IRIS Core, its controllers, workers, model providers, the Founder Command Center, and development agents. It consolidates active operating rules without deleting source documents, history, capabilities, providers, tests, evidence, or compatibility paths.

The manually maintained contract is `config/iris-operating-contract.v1.json`. The compiler at `scripts/contracts/compile-operating-contract.mjs` validates, canonicalizes, hashes, and writes `generated/iris-operating-contract.compiled.json`. The generated artifact is never edited by hand.

## Source and authority order

The authored contract binds every source by repository-relative path, role, and SHA-256 digest. Loading fails closed when the contract schema, compiled digest, or a source digest differs from the bound value.

Runtime decisions use this order:

1. current explicit Founder instruction;
2. the validated Canonical Operating Contract;
3. contract-bound canonical sources for details not represented in the runtime contract;
4. verified live repository, provider, access, and workstation state; and
5. prior conversation or model memory as supporting context only.

An explicit instruction does not silently convert a protected effect into an ordinary capability. A contract or source conflict stops the affected operation and reports exact evidence.

## Actor ownership

- IRIS Core owns identity, policy, authority evaluation, evidence, and completion truth.
- The Founder owns objectives, protected approvals, Full-access activation, interruption, revocation, and final acceptance.
- The IRIS controller executes a validated decision under an active grant or exact protected approval.
- A model provider has `modelAuthority: "none"`; it proposes reasoning and presentation but cannot grant itself authority.
- A worker or provider performs only its controller-issued bounded task and records evidence.
- The Founder Command Center displays and forwards Core-owned state; it does not invent authority.

Model authority and controller disposition are separate fields. A model's lack of authority must never be misreported as the absence of a valid controller route.

## Live capability evidence

Core derives a live capability snapshot from the compiled contract and verified provider, access, compatibility, and health evidence. Each ordinary capability appears once in contract order and resolves to one live status. UI-only labels do not become Core truth.

The snapshot must bind the exact contract digest. Missing, duplicate, stale, or contradictory evidence fails closed rather than being filled with model assumptions.

## Five deterministic outcomes

Every actionable objective resolves to exactly one controller-owned outcome:

1. `execute-now` when every required ordinary capability is registered, healthy, compatible, and authorized;
2. `acquire-capability` when a capability or provider is missing or access must be obtained through the approved acquisition path;
3. `request-protected-approval` when the requested effect remains permanently protected;
4. `repair-runtime` when a registered provider, contract, or runtime is unhealthy; or
5. `report-terminal` when the objective is complete, failed, cancelled, or unsupported with exact evidence.

IRIS must not issue a generic refusal when an execution, acquisition, protected-approval, or repair route exists. Unsupported or impossible work is terminal only after source-backed evidence identifies the missing route.

## Operating context

Models and workers receive only the relevant operating context: contract version and digest, objective, controller decision, applicable live capabilities, requested protected effects, exact evidence references, and `modelAuthority: "none"`. They do not receive the full governance library unless the task requires a particular source.

The context assembler rejects contract-digest mismatch, objective mismatch, missing capability evidence, unknown protected effects, and unknown decision outcomes.

## Founder access lifecycle

Founder Full Access is an authenticated, Founder-initiated controller grant for registered ordinary capabilities. It is session-bound, visible, auditable, interruptible, and revocable. It ends on logout, explicit revocation, emergency stop, session invalidation, or gateway replacement.

Full Access never silently includes credentials, spending, deployment, public or LAN exposure, repository administration, force-push, history rewriting, destructive data operations, or Phase 0 graduation. Legacy restricted access can remain time-bounded for compatibility; the canonical Full-access route does not use an arbitrary short countdown.

## Capability acquisition and approval lifecycle

When a capability is missing, IRIS identifies the exact capability, failed preflight condition, provider evidence, official source, pinned version and digest, license, cost, permissions, data exposure, verification, rollback, removal, registry change, and required approval.

An acquisition proposal binds the contract digest and canonical revision. Its approval remains active until one-time consumption, replacement, explicit revocation, or canonical contract/repository drift. A date argument retained for backward compatibility does not create a short approval timer.

Technical availability does not create permission. Credentials, spending, elevation, deployment, public exposure, and administration remain protected even when software is already installed.

## Agent inspection

Development agents must run:

```text
node scripts/dev/iris-dev.mjs contract inspect --json
```

The command validates the compiled artifact and returns its identity, version, digest, authority order, Core revision, and optional exact capability. It never claims that the inspecting agent has authority or approval. Unknown capabilities and invalid or missing compiled artifacts produce a nonzero exit.

## Failure behavior

Startup or inspection fails closed on:

- invalid authored or compiled schema;
- compiled-digest mismatch;
- contract-bound source drift;
- unknown or duplicate ordinary capabilities or protected effects;
- missing or contradictory live evidence;
- contract/context digest mismatch; or
- an objective that requests an unknown capability or effect.

The failure must identify the exact violated invariant without widening authority or discarding rollback evidence.

## Compatibility and preservation

This change is additive. Existing workers, models, providers, capabilities, approvals, audit records, evidence, rollback artifacts, governance sources, and Phase 0 records remain intact. Legacy wording maps through explicit aliases while consumers migrate. Retirement candidates require a separately reviewed inventory and separate deletion authorization.

## Rollback

Rollback is history-preserving:

1. revert the implementation commits in reverse order;
2. regenerate the compiled artifact from the restored authored contract;
3. run focused contract and consumer tests, followed by `pnpm verify`;
4. confirm the restored compiled digest and source bindings; and
5. preserve the reverted commits and evidence in Git history.

Do not hand-edit the generated artifact, force-push, rewrite history, or delete governance and evidence to roll back this contract.

## Phase 0 boundary

Implementing this contract does not complete Phase 0 Development Independence. Graduation remains a separate, evidence-bound Founder-operated real canonical multi-file self-upgrade. During that graduation workflow, Codex and Claude are audit-only.
