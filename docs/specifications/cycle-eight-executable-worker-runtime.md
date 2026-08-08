# Cycle Eight Executable Worker Runtime

**Status:** Canonical Cycle Eight baseline; deterministic hardening candidate locally implemented and not published

## Objective

Cycle Eight converts the Cycle Seven planning-only coding worker into a real, bounded local implementation worker. IRIS may inspect an exact repository revision, create one disposable Git worktree, create approved new files or apply digest-bound exact replacements to existing files only inside Founder-approved paths, run exact offline materialization, baseline, normalization, and verification commands, repair failed checks within a fixed iteration limit, and preserve a local candidate branch and commit.

## Exact authority

Every execution proposal binds the repository, base revision, unique candidate branch, objective, readable paths, writable paths, forbidden paths, materialization commands, baseline commands, normalization commands, verification commands, file and byte limits, iteration limit, timeout, expiry, USD 0 budget, and the absence of canonical-write, external-mutation, and authority-expansion rights. The authenticated Founder must type the exact digest-bound approval statement before a workspace can be created.

Cycle Eight does not authorize direct changes to the canonical checkout or `main`, pushing, pull requests, merging, deployment, public or LAN exposure, credentials, paid services, provider resources, spending, messaging, or arbitrary network access. A successful run produces a local candidate checkpoint for later human or governed review; it does not publish that checkpoint.

The implementation entered canonical `main` through IRIS Core PR #46 at merge commit `86a6b8f9492b5ff4acd7dc71d930a96bca6a40db` and Founder Command Center PR #14 at merge commit `b254f94bf86c5ed910a7b42830b4d48b7fcd4a0e` after independent review and full verification.

## Lifecycle

`preflight -> preparing-workspace -> materializing -> verifying (baseline) -> planning -> editing -> verifying (normalization and exact checks) -> repairing -> checkpointing -> completed`

Preflight proves the clean canonical worktree, exact revision, exact GitHub origin, unique candidate branch, required executables, and local coding-model availability. Dependency materialization is an exact offline frozen-lockfile operation with lifecycle scripts disabled. Verification commands are exact argument arrays and do not use a shell.

Each candidate mutation is locally validated after model generation. Existing-file updates must bind the exact SHA-256 digest supplied in repository context and contain only unique, non-overlapping exact replacements; deletes bind the same digest, while creates alone may supply complete content. Duplicate paths, stale digests, ambiguous or overlapping replacements, NUL content, traversal, filesystem or Git-index symbolic links, forbidden paths, unapproved writes, credential-like output, too many files, and too many changed bytes fail closed. Writes use a same-directory temporary file and atomic rename, preserving existing mode bits. Commands may modify only the same approved paths; the runtime re-reads the final Git status and contents before checkpointing.

## Repair and recovery

Failed checks are returned to the same bounded coding agent for at most three iterations. Journal version 3 binds the exact proposal and approval and durably records every materialization, baseline, normalization, and verification result; each command record retains the exact command, exit code, digest and byte count of observed stdout followed by observed stderr, and only a bounded redacted presentation. Synthetic process-error text is excluded from the observed-byte digest. Attempt records bind the plan digest, changed paths, diff digest, and timestamps. A stop, process failure, invalid mutation, failed materialization, or exhausted repair limit preserves the disposable workspace as `stopped` or `recovery-ready`. Resume revalidates the immutable approval binding before any provider or workspace action, then reuses the remaining iteration budget and latest durable failed checks. Earlier journal versions remain inspectable but cannot resume without complete binding and command evidence.

Cleanup is a structured, idempotent two-phase operation. It proves the target is beneath the configured disposable root, removes or prunes Git worktree registration, removes the physical directory with bounded retries, and independently verifies both registration absence and filesystem absence. Any incomplete proof remains `recovery-ready`; discard and post-checkpoint cleanup never report success merely because one cleanup step ran. A tampered journal event chain cannot resume or discard through the runtime. Gateway shutdown aborts active executions and briefly waits for their recovery state to be journaled before process exit.

## Founder Command Center

The Develop screen selects IRIS Core or the Founder Command Center, captures the exact objective and read/write paths, displays proposal-bound baseline, normalization, and verification command counts, displays every capability-preflight result, presents the exact typed approval, starts the asynchronous execution, polls truthful progress, reconstructs durable command and cleanup evidence from the Core journal after gateway restart, displays changed paths and the local candidate checkpoint, and exposes stop, resume, and discard controls. The browser session and CSRF boundary protect every mutation endpoint.

The production gateway and Core read service retain fixed loopback-only hosts and their recorded default ports. Bounded environment port overrides exist only so an isolated verification gateway and its paired Core service can run without stopping an active Founder session; invalid, privileged, or out-of-range ports fail closed.

## Completion evidence

Cycle Eight is complete locally when strict contract tests pass, a real temporary Git repository proves that a candidate branch can be created while canonical `main` and its files remain unchanged, repair and recovery tests pass, the Command Center client and gateway routes pass authentication and schema tests, the full verification suites pass in both repositories, and a real local-model disposable proof is recorded without credentials or raw private reasoning.

The 2026-08-06 local proof used `qwen3-coder:30b` on a fictional two-file arithmetic repository. It repaired the exact approved implementation file in one iteration, passed the real Node test, created a local candidate commit, preserved canonical revision and content equality, verified workspace cleanup and the event chain, used no credentials, made no external mutation, and cost USD 0. The retained evidence contains digests and outcomes, not raw model reasoning.
