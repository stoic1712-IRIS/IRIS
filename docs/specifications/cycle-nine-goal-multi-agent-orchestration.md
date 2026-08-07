# Cycle Nine Goal and Multi-Agent Orchestration

**Status:** Locally verified additive implementation awaiting governed integration

## Objective

Cycle Nine D adds durable goal and multi-agent orchestration to IRIS Core without deleting, replacing, or weakening any Phase 0, wave, release, or earlier cycle capability. The runtime accepts measurable goals, validates their dependency graph and capability requirements before execution, assigns bounded work to isolated worker contexts, and preserves a recoverable audit trail.

This implementation does not claim Phase 0 graduation, deploy IRIS, grant credentials, or authorize provider mutation. It is an IRIS-owned coordination primitive that later Founder-facing and software-delivery cycles can compose.

## Goal contract

Each goal binds:

- an exact identifier, objective, expiry, completion criteria, context budget, and maximum parallelism;
- tasks with explicit dependencies, worker role, required capabilities, read and write paths, bounded context, completion criteria, reviewer requirement, and maximum attempts; and
- injected worker, reviewer, clock, capability catalog, and persistence adapters.

Creation fails before execution when a required capability is absent, a dependency is missing or cyclic, task identifiers are duplicated, parallelism exceeds the configured ceiling, or unordered tasks declare overlapping write paths. This prevents a goal from starting when its execution surface is incomplete or unsafe.

A goal containing reviewer-required work also fails preflight when no independent reviewer adapter is available. Goal-level completion is not inferred from task status alone: a separate injected completion evaluator must bind every completed task's summary, evidence, and output digest to the exact goal completion criteria.

## Execution and review

Ready tasks may run concurrently only when their dependency and write-set contracts permit it. Each worker receives only its task definition, dependency evidence, deterministic compacted context, bounded steering messages, and an abort signal. Worker results must remain inside their declared write paths.

Execution may be parallel, but all snapshot mutations are serialized per goal. Workers never load and blindly overwrite independent copies. File-store writes use unique temporary names and atomic rename. Worker, reviewer, and completion-evaluator calls have a bounded timeout, including providers that ignore abort signals.

Reviewer-required tasks are inspected by a distinct reviewer actor. A producer cannot approve its own output. A bounded `revise` result returns the exact findings to the task as steering and retries only while the task's attempt budget remains. A passing independent review is required before downstream tasks become ready.

## Founder controls and recovery

The orchestrator supports pause, resume, cancel, and task-scoped steering. Pause and cancel abort active task signals without converting the interruption into a false success. Restoring an interrupted snapshot converts active work to `recovery-ready`, after which the goal can be resumed from its persisted state.

Every provider result is reapplied only after reloading the latest serialized snapshot and rechecking the goal, task, and abort state. A late worker or reviewer result therefore cannot overwrite a Founder pause or cancellation.

The memory store is suitable for hermetic operation. The file store validates every snapshot and uses a restricted-permission temporary file plus atomic rename. Context and steering reject secret-like material before persistence.

## Evidence integrity

Every lifecycle event binds its sequence, timestamp, goal and optional task identifiers, safe detail, prior event digest, and its own SHA-256 digest. `verifyGoalEventChain` rejects altered sequence, mixed goal identity, duplicate event identity, previous-digest changes, or event-digest tampering even when an attacker recomputes the modified hashes.

## Verification requirements

The focused acceptance suite covers capability and reviewer preflight, dependency ordering and evidence, durable parallel execution, overlapping-write denial, deterministic compaction, independent repair and self-review denial, measurable completion evaluation, pause/resume/cancel/steer, non-cooperative provider timeout, terminal cancellation, out-of-scope writes, atomic file recovery, and event identity and chain integrity. The complete repository `pnpm verify` command remains mandatory before integration.

Passing tests prove this additive runtime is ready for governed integration. They do not independently prove deployment, provider authority, permanent Phase 0 graduation, or Founder handoff certification.
