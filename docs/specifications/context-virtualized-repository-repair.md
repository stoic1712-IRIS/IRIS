# Context-Virtualized Repository Repair

**Status:** Locally implemented candidate; publication not authorized

**Owner:** IRIS Core

**Contract version:** 1.0.0

## Purpose

IRIS can reason over and repair an approved repository scope that is larger than one model prompt or response. The capability divides the exact approved scope into bounded stages, supplies only relevant digest-bound line slices, applies locally validated exact edits inside a disposable candidate, checkpoints progress, resumes compatible retained work, and runs the proposal's fixed verification suite over the accumulated result.

This capability changes task-size handling. It does not grant canonical repository, GitHub, credential, deployment, spending, public or LAN, provider, or Phase 0 graduation authority.

## Ownership and Authority

IRIS Core owns:

- the proposal, approval, path, revision, resource, and authority validation;
- context selection and exact-edit materialization;
- candidate workspace lifecycle and resume journal;
- verification, evidence, cleanup, and final result validation.

The local model is an untrusted replaceable generator. It can return structural exact edits or request more already-allowlisted repository context. It cannot create a path, command, approval, scope, provider action, or authority.

## Stage Packet Contract

One proposal editable path is active per stage. A deterministic packet contains:

- the exact defect statement;
- the active target path;
- fixed verification command identifiers;
- prior bounded context requests; and
- line-addressed slices with path, one-based start and end lines, SHA-256 digest, and content.

The packet builder:

1. reads only files named by the approved editable and context lists;
2. includes the active target without duplicating it when it also appears in the context list;
3. ranks fixed line windows using defect, path, declaration, test, and prior-request terms;
4. deduplicates `(path, start line, end line, digest)` slices; and
5. refuses a packet that cannot include any target slice within the explicit byte ceiling.

The full repository scope may exceed one context window. Each individual model packet may not.

## Exact-Edit Contract

The model response has `summary`, `edits`, and `contextRequests` fields. A response may contain edits or context requests, never both.

Each edit contains:

- the active `path`;
- a non-empty exact `before` string;
- a different `after` string;
- a rationale; and
- expected verification impact.

Local validation applies edits sequentially and requires the current candidate to contain `before` exactly once. Missing text is stale; repeated text is ambiguous. A no-op, wrong path, secret-bearing value, invalid text, oversized result, or proposal change-limit violation fails closed. The model never writes directly to disk.

A context request contains an already-allowlisted path, a bounded query, and a reason. Repeated requests that add no new evidence fail with `CONTEXT_REQUEST_STALLED`. Six unanswered rounds fail with `CONTEXT_REQUEST_LIMIT`.

## Ordered Lifecycle

For each editable path in proposal order, the worker performs:

`read current candidate -> build packet -> stream model output -> validate -> retrieve context or materialize exact edits -> write candidate -> checkpoint`

Later stages see earlier validated candidate edits. After all stages, the worker computes the exact diff, confirms that every and only approved editable path changed, enforces the proposal changed-line ceiling, and runs the fixed verification commands. Any failed or skipped required check prevents a `verified` verdict.

## Streaming and Activity

Ollama uses newline-delimited streaming responses. Every received byte resets the model inactivity watchdog. The worker does not impose the former 120-second per-call cap. It retains:

- a finite inactivity interval for model streams and a finite timeout for each local operation;
- the per-packet input ceiling;
- the semantic model-output ceiling;
- a bounded wire-envelope allowance;
- bounded context rounds and editable stages; and
- Founder interruption through the surrounding governed runtime.

A silent stream ends after one full configured inactivity interval. Every received chunk starts a fresh interval, so a responsive bounded stream is not rejected merely because a complete-file response would have taken longer than the old fixed call timeout.

## Resume Journal

The journal is stored beside, not inside, the disposable Git worktree as `<candidate-id>.iris-repair-journal.json`. It never enters the candidate diff.

It binds:

- contract schema version;
- repository, base and expected remote revisions;
- a scope digest covering defect, finding, paths, commands, limits, model, and zero-authority fields;
- candidate identifier and base HEAD;
- canonical before digests for every editable and context file;
- contiguous completed stage indices, paths, after digests, model-output digests, and timestamps;
- bounded context-slice metadata without source content; and
- last progress time and terminal state.

A replacement proposal may resume when its execution scope digest is identical even if its proposal identifier, proposal digest, creation time, or approval material differs. Resume rejects scope drift, HEAD drift, non-contiguous stages, unexpected changed paths, missing files, or a digest mismatch. Before every model packet, the worker revalidates every editable and context file against either its canonical-before digest or its completed-stage digest and rejects symlinks or non-regular files. Incompatible candidates remain isolated until their own retention cleanup rather than being repurposed.

## Progress Evidence

The worker emits `REPAIR_PROGRESS` records containing only stage index, target path, state, elapsed milliseconds, input bytes, output bytes, and a stable error code. It does not log source content, model content, approval statements, terminal codes, secrets, or binding material.

## Stable Failure Classes

- `STAGE_TARGET_DENIED`: a stage or edit targets another path.
- `STAGE_EDIT_STALE`: `before` is no longer present.
- `STAGE_EDIT_AMBIGUOUS`: `before` occurs more than once.
- `STAGE_MIXED_RESPONSE_DENIED`: edits and context requests were mixed.
- `CONTEXT_PATH_DENIED`: a request names an unapproved or unavailable path.
- `CONTEXT_PACKET_BUDGET_DENIED`: no safe target slice fits.
- `CONTEXT_REQUEST_STALLED`: a model repeats already supplied requests.
- `CONTEXT_REQUEST_LIMIT`: bounded retrieval rounds were exhausted.
- `MODEL_INPUT_OVERSIZED` / `MODEL_OUTPUT_OVERSIZED`: packet or response ceilings were exceeded.
- `REPAIR_RESUME_*`: retained scope, HEAD, path, stage, or file evidence failed validation.
- existing repository, revision, file-mode, candidate-path, verification, and cleanup failures remain unchanged.

## Cleanup and Rollback

A retryable interrupted candidate is retained only inside the validated candidate parent for the proposal retention period. Changed-path inspection covers unstaged, staged, untracked, deleted, renamed, copied, and type-changed paths before allowlist enforcement. A verified candidate is removed with its journal through the exact Git worktree cleanup path before a result may attest `cleanupState: completed`; either surviving artifact fails closed. Stale retained candidates are removed only after validating their bounded candidate identifier and containment.

Before publication, rollback is deletion of this isolated development worktree and branch after preserving required evidence. After a future merge, rollback is a normal history-preserving revert of the exact merge commit. Force-push, history rewrite, broad filesystem deletion, and canonical evidence deletion are not rollback mechanisms.

## Verification Evidence

Test-first regressions cover:

- exact edit success and stale, ambiguous, no-op, secret-bearing, and wrong-target denial;
- allowlisted context retrieval and mixed-response denial;
- deterministic byte-bounded line slices with target and requested context evidence;
- journal compatibility across replacement approval material plus tamper, path, and scope denial; and
- removal of the complete-file instruction and 120-second call cap in favor of streaming and bounded progress.

Focused and full repository verification must both pass before publication can be proposed. Local implementation and verification do not constitute publication, canonical adoption, execution of a repair proposal, or Phase 0 graduation.

## Future Provider Replacement

Another local or approved external model may replace Ollama only behind the same IRIS-owned packet, exact-edit, scope, journal, progress, verification, and authority contracts. Larger models may reduce retrieval rounds; they do not become owners of memory, approval, repository state, or policy.
