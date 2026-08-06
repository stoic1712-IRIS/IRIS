# IRIS Founder Command Center Release Seven Security Contract

**Contract version:** `iris.stoic/governed-repository-repair-worker/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Authority Boundary

Release Seven grants no standing authority. Proposal generation is read-only. Candidate-repair activation is one `R2` action requiring authenticated, exact, one-time, digest-bound Founder approval. The producer, model, worker, Command Center, and IRIS may not approve their own output. Candidate verification does not authorize canonical adoption or any `R3` Git or provider action.

## Repository and Revision Boundary

Only `stoic1712-IRIS/IRIS` and `stoic1712-IRIS/iris-founder-command-center` are supported. Every proposal binds a full base commit, expected remote commit, repository identity, editable manifest, context manifest, and finding digest. Mutable branch names, arbitrary roots, alternate object databases, submodules, uncommitted sources, sparse external directories, and remote URLs supplied by a user or model are rejected.

## Disposable Workspace Boundary

IRIS creates one unique worktree beneath an exact approved workspace root. The resolved workspace must remain within that root and must not preexist. Symlinks, junctions, reparse-point escapes, submodules, nested repositories, and path traversal are denied. The candidate branch and directory are temporary and have no upstream. Canonical refs, index, worktree, configuration, hooks, remotes, and credentials are read-only.

## Model Boundary

The only model is local Ollama `qwen3:8b` at exact loopback endpoint `http://127.0.0.1:11434`, with temperature zero, thinking disabled, structured output, timeout, and `keep_alive: 0`. The model receives no shell, filesystem, Git, tool, browser, delegation, credential, provider, or general-network capability. Repository content, logs, comments, and model output are untrusted data and cannot expand authority.

## Candidate-Write Boundary

- At most 20 editable files, 40 context files, 2,000 changed lines, and 512 KiB aggregate candidate output.
- Only existing or explicitly proposed new UTF-8 text files in the approved manifest may be written.
- Executables, binaries, generated bundles, lockfiles, dependency manifests, workflows, Git internals, environment files, credentials, keys, certificates, large files, links, and submodules are denied in version 1.
- Deletes, renames, mode changes, dependency changes, configuration of remotes or hooks, and edits outside the manifest are denied.
- Model output must provide complete replacement content; free-form shell commands and model-generated patches are not executed.
- Before and after digests are computed, and the resulting Git diff must exactly match the validated candidate manifest.

## Verification Boundary

The model cannot select or execute verification. IRIS resolves proposal-bound command identifiers from a compiled allowlist. Version 1 may invoke only repository-defined formatting checks, zero-warning lint, strict type checking, unit and integration tests, production builds, dependency-integrity checks, secret scans, bundle scans, and repository diagnostics. Commands use fixed arrays, sanitized environment variables, disabled Git hooks and optional locks, explicit timeouts, bounded output, and no network.

## Dependency Boundary

After worktree creation and before model invocation, IRIS may run one fixed pnpm materialization with offline mode, frozen lockfile, and lifecycle scripts disabled. All packages must already exist in the local content-addressable store. Any download attempt, missing cached package, manifest or lockfile change, lifecycle execution, different package manager, or dependency graph change fails closed. The resulting disposable `node_modules` is deleted during cleanup. This future action is part of the exact `R2` activation proposal; no dependency materialization is authorized by this planning document.

## Approval, Replay, and Session Controls

The loopback-only Founder Command Center retains exact Host and origin enforcement, Fetch Metadata, HttpOnly SameSite session cookies, CSRF binding, short expiry, terminal-bound one-time codes, attempt limits, constant-time comparisons, and consumed-before-execution semantics. Proposal or result material is process-memory-only unless separately approved sanitized evidence is written.

## Failure and Repair

Any schema failure, revision drift, remote mismatch, dirty bound path, path or type violation, secret match, output overflow, timeout, model failure, verification failure, unexpected changed file, cleanup failure, or evidence mismatch stops execution. Verification failure may produce a new proposed iteration, but no repair retry occurs without new exact Founder approval.

## Cleanup and Rollback

Runtime rollback terminates the model request and child processes, removes the disposable worktree and temporary branch, clears approval material, closes local ports, confirms Ollama has unloaded the model, and proves canonical repositories and refs remain equal to their pre-execution values. A candidate retained for Founder inspection expires after 30 minutes and must then be deleted unless separately authorized. Because no canonical commit is created, rollback is workspace deletion; future canonical adoption must remain history-preserving.

## Required Verification

Tests must cover strict schemas; deterministic digests; repository, revision, remote-equality, manifest, command, and workspace binding; stale, altered, replayed, and failed approvals; approval consumption before writes; path traversal; symlink, junction, reparse point, submodule, nested repository, binary, non-UTF-8, secret, generated-file, lockfile, dependency-manifest, workflow, oversized input/output, excessive file/line count, delete, rename, mode-change, unexpected-diff, prompt-injection, malformed-model-output, timeout, provider failure, command failure, repair reapproval, and cleanup denial; plus zero canonical writes, full test/build verification, a fictional multi-file repair proof, and complete process/model/worktree cleanup.

## Reapproval Triggers

Any different repository, revision, finding, editable or context path, model, endpoint, command, timeout, limit, dependency action, file category, workspace root, persistence, network destination, credential, provider, exposure, cost, canonical write, Git action, deployment, or repair iteration requires a new exact proposal and Founder approval.
