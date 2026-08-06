# Cycle Eight Executable Worker Runtime

**Status:** Locally complete; publication pending

## Objective

Cycle Eight converts the Cycle Seven planning-only coding worker into a real, bounded local implementation worker. IRIS may inspect an exact repository revision, create one disposable Git worktree, apply model-generated full-file mutations only inside Founder-approved paths, run exact offline materialization and verification commands, repair failed checks within a fixed iteration limit, and preserve a local candidate branch and commit.

## Exact authority

Every execution proposal binds the repository, base revision, unique candidate branch, objective, readable paths, writable paths, forbidden paths, materialization commands, verification commands, file and byte limits, iteration limit, timeout, expiry, USD 0 budget, and the absence of canonical-write, external-mutation, and authority-expansion rights. The authenticated Founder must type the exact digest-bound approval statement before a workspace can be created.

Cycle Eight does not authorize direct changes to the canonical checkout or `main`, pushing, pull requests, merging, deployment, public or LAN exposure, credentials, paid services, provider resources, spending, messaging, or arbitrary network access. A successful run produces a local candidate checkpoint for later human or governed review; it does not publish that checkpoint.

## Lifecycle

`preflight -> preparing-workspace -> materializing -> planning -> editing -> verifying -> repairing -> checkpointing -> completed`

Preflight proves the clean canonical worktree, exact revision, exact GitHub origin, unique candidate branch, required executables, and local coding-model availability. Dependency materialization is an exact offline frozen-lockfile operation with lifecycle scripts disabled. Verification commands are exact argument arrays and do not use a shell.

Each candidate mutation is locally validated after model generation. Duplicate paths, traversal, symbolic links, forbidden paths, unapproved writes, credential-like output, too many files, and too many changed bytes fail closed. Commands may modify only the same approved paths; the runtime re-reads the final Git status and contents before checkpointing.

## Repair and recovery

Failed checks are returned to the same bounded coding agent for at most three iterations. A stop, process failure, invalid mutation, failed materialization, or exhausted repair limit preserves the disposable workspace as `stopped` or `recovery-ready`. An atomic mode-0600 journal records the exact proposal, approval, workspace, state, and hash-chained events. Resume reuses the unchanged approval and remaining iteration budget. Discard is explicit and verifies worktree cleanup. A tampered journal event chain cannot resume or discard through the runtime. Gateway shutdown aborts active executions and briefly waits for their recovery state to be journaled before process exit.

## Founder Command Center

The Develop screen selects IRIS Core or the Founder Command Center, captures the exact objective and read/write paths, displays every capability-preflight result, presents the exact typed approval, starts the asynchronous execution, polls truthful progress, displays changed paths and the local candidate checkpoint, and exposes stop, resume, and discard controls. The browser session and CSRF boundary protect every mutation endpoint.

## Completion evidence

Cycle Eight is complete locally when strict contract tests pass, a real temporary Git repository proves that a candidate branch can be created while canonical `main` and its files remain unchanged, repair and recovery tests pass, the Command Center client and gateway routes pass authentication and schema tests, the full verification suites pass in both repositories, and a real local-model disposable proof is recorded without credentials or raw private reasoning.

The 2026-08-06 local proof used `qwen3-coder:30b` on a fictional two-file arithmetic repository. It repaired the exact approved implementation file in one iteration, passed the real Node test, created a local candidate commit, preserved canonical revision and content equality, verified workspace cleanup and the event chain, used no credentials, made no external mutation, and cost USD 0. The retained evidence contains digests and outcomes, not raw model reasoning.
