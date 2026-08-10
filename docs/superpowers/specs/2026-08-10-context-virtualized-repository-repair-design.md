# Context-Virtualized Repository Repair Design

**Status:** Founder-approved architecture; implementation candidate

**Date:** 2026-08-10

**Repository:** `stoic1712-IRIS/IRIS`

## Objective

Make repository repair effectively independent of a single model context window. IRIS must be able to complete a proposal whose repository scope is larger than one prompt or response by retrieving only relevant evidence, applying exact edits in ordered stages, checkpointing progress, requesting more context when necessary, verifying the accumulated candidate, and resuming a compatible retained candidate without changing the approved objective.

This design preserves every existing authority boundary. It changes how IRIS reasons over and edits a disposable candidate; it does not grant canonical repository, GitHub, deployment, credential, spending, network, or Phase 0 graduation authority.

## Verified Failure

The current live worker creates one Ollama request containing every editable file and every context file. The Command Center currently uses the editable list as the context list, so the same source is serialized twice. The model is then asked to return complete replacement contents. For the observed five-file repair, the unique source payload is 106,036 bytes and 2,829 lines before JSON, instructions, duplication, and output. The running `qwen3:8b` context is 32,768 tokens. The worker also caps each operation at 120 seconds even though the proposal has a 600-second runtime limit.

The failure is therefore architectural: an oversized duplicated prompt, an output-amplifying complete-file contract, and a fixed per-call abort. Raising only the context or timeout moves the failure boundary but does not remove it.

## Selected Architecture

### 1. Context virtualization

The worker constructs a deterministic repository map from exact base-revision files. It sends one target file stage at a time. The target is represented by line-addressed slices selected from the defect statement, path tokens, declarations, and prior context requests. Read-only context excludes the target and deduplicates every `(path, line range, digest)` slice.

Each packet has an explicit byte budget below the proposal input ceiling. If the model needs missing evidence, it returns a bounded allowlisted context request. IRIS retrieves matching slices and repeats the same stage. A model cannot request a new path, network source, command, credential, or authority.

### 2. Exact-edit output

The model returns strict structural data:

- a stage summary;
- zero or more exact edits containing `path`, `before`, `after`, rationale, and expected verification impact; and
- zero or more context requests containing an allowlisted path and plain-text query.

`before` must be non-empty, occur exactly once in the current candidate file, and still match the current candidate digest. `after` must be different, text-only, and secret-safe. The local validator applies edits sequentially and rejects ambiguous, stale, overlapping, no-op, out-of-scope, oversized, or unsafe edits. The model never supplies a full replacement unless the exact approved file itself is smaller than one ordinary edit and local limits still pass.

### 3. Ordered stages

Every editable file becomes one deterministic stage, ordered as declared in the exact proposal. Later stages read the already-modified disposable candidate, which preserves cross-file dependencies without requiring one monolithic response. A stage may make several exact edits to its target file but cannot modify another stage's path.

The stage loop is:

`assemble packet -> request model -> validate -> request more context or apply exact edits -> checkpoint -> next stage`

After all stages, the existing fixed verification suite runs over the accumulated candidate. Verification failure remains `needs-repair`; it is not converted into success.

### 4. Resumable candidate journal

The disposable candidate receives a non-canonical journal outside the Git diff. The journal binds:

- schema version;
- repository, base revision, expected remote revision, and finding digest;
- defect, editable-path, context-path, and verification-scope digest;
- canonical before digests;
- completed stage identifiers and resulting file digests;
- requested context slices and model-output digests;
- last progress time and terminal state.

A later activation may resume only when the newly approved proposal has the same repository, base, expected remote, finding, defect, paths, commands, and zero-authority fields, and when every recorded candidate digest matches disk. Created time, proposal ID, approval code, and proposal digest may differ because approval is new; execution scope may not. Every stage packet rechecks all editable and context files against canonical-before or completed-stage digests and regular-file modes. Drift, tamper, changed scope, or any staged, unstaged, untracked, deleted, renamed, copied, or type-changed path outside the exact allowlist denies resume.

Successful verification removes the journal and candidate through the existing cleanup path before cleanup completion is attested. Surviving worktree or journal state fails closed rather than producing a successful result. Retryable model or process failure retains the candidate only until the proposal retention bound. The next run first removes stale retained candidates using exact validated paths. Canonical worktrees and Git history are never cleanup targets.

### 5. Activity-aware model transport

Ollama uses streaming responses. The worker maintains a model idle watchdog rather than a fixed total generation timeout. Each received response chunk resets the idle timer. A stream that produces no bytes within the proposal runtime bound aborts safely; a stream that continues producing progress is allowed to finish within the finite stage and candidate byte ceilings.

This separates safety limits from task-size limits:

- stage count is bounded by the approved editable file list;
- input and output bytes remain bounded;
- model inactivity remains interruptible;
- task completion can span many stages and resumed activations.

### 6. Progress and evidence

The worker writes structured progress events to stderr using bounded metadata only: stage number, path, state, elapsed milliseconds, input bytes, output bytes, and stable error code. It never logs source content, model output, secrets, approval codes, or binding material. The Command Center may later render these events without becoming the authority owner.

The final result retains the existing repository-repair result contract: changed file digests, exact diff, verification results, zero canonical/GitHub effects, cleanup state, and rollback evidence.

## Rejected Alternatives

### Increase context, output, and timeout only

This is a temporary optimization. It increases VRAM use and latency and fails again when repository or output size grows. It does not solve duplication, full-file output amplification, or crash recovery.

### Use an external frontier model for every repair

This can improve single-call performance but introduces credentials, cost, data disclosure, and provider dependence. External specialists may remain optional approved providers behind the same IRIS-owned staged contract; they are not required by this design.

### Remove all safety limits

Unbounded prompts, output, runtime, paths, or retries make hangs and scope expansion harder to distinguish from useful work. This design removes the single-call size bottleneck while retaining finite, evidence-backed stage, byte, path, resource, cancellation, and cleanup controls.

## Compatibility

- Existing exact repair proposals and Founder approval statements remain valid.
- Existing candidate-only authority and fixed verification commands remain intact.
- The Command Center does not require a contract change for the first implementation.
- No dependency or lockfile changes are required.
- The existing complete-file candidate validator remains available for compatibility but the live worker uses the exact-edit path.

## Acceptance

1. A proposal with duplicate editable/context paths serializes each source slice once.
2. A repository larger than one model context is processed through multiple bounded packets.
3. Exact edits reject stale, ambiguous, no-op, unsafe, and non-allowlisted content.
4. Context requests cannot broaden paths or authority.
5. A compatible retained candidate resumes at the first incomplete stage; drift and tamper fail closed.
6. Continued Ollama output resets the idle watchdog; a stalled stream terminates with bounded evidence.
7. Existing focused and full repository verification passes.
8. No canonical repository, GitHub, credential, deployment, spending, public/LAN, or Phase 0 effect is introduced.

## Rollback

Before publication, remove the isolated branch and worktree after preserving any required evidence. After a future merge, use a history-preserving revert of the exact merge commit. Retained disposable candidates are removed only through the validated candidate cleanup routine. No rollback uses force-push, history rewrite, broad deletion, or changes to canonical evidence.
