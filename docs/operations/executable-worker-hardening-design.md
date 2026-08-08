# Deterministic Executable-Worker Hardening Design

**Status:** Founder-approved for local implementation and verification; not canonical and not authorized for publication

**Date:** 2026-08-07

## Objective

Repair the Cycle Eight executable-worker failure that allowed a local model to corrupt unrelated text while attempting a bounded README edit, lost the complete verification-command result vector, and left an unregistered disposable directory after cleanup failed. Preserve every existing authority boundary while making future runs deterministic, restart-safe, auditable, and truthfully recoverable.

## Verified failure

- The model returned complete replacement content for an existing file, and the runtime overwrote that file without proving that unrelated bytes remained unchanged.
- The exact verification commands ran, but command results lived only in the in-memory result. The durable execution journal retained no per-command evidence.
- Resume restarted with an empty `previousChecks` array, so a restarted process could not give the repair model the failure evidence already produced.
- Cleanup unregistered the Git worktree before physical deletion and returned only `false`, losing the failed step and leaving an orphan directory.
- Discard transitioned to `stopped` even when cleanup was not verified.

## Chosen approach

Use digest-bound exact replacements for updates rather than model-authored complete-file rewrites or heuristic diff inspection. Exact replacements are deterministic, structurally simple for the local model, and prove that untouched bytes cannot change.

### Mutation contract

The mutation object remains a uniform structured object so the Ollama JSON schema does not require complex unions:

- `create`: requires complete `content`; forbids `expectedContentDigest` and replacements.
- `update`: requires `expectedContentDigest` and one or more exact `{ oldText, newText }` replacements; forbids complete `content`.
- `delete`: requires `expectedContentDigest`; forbids content and replacements.

For updates, the runtime reads the current file, verifies its SHA-256 digest, requires every nonempty `oldText` to occur exactly once in the original content, rejects overlapping ranges, and applies replacements from the end of the file toward the beginning. It then validates the final content, byte limit, credential patterns, and actual Git changed paths. NUL-bearing or unreadable files are denied.

Repository context headings expose each readable file's SHA-256 digest and byte size. This supplies the model with the exact value that an update or deletion must bind.

### Atomic file effects

Writes use a temporary file in the target directory followed by an atomic rename. Existing executable mode bits are preserved where supported. A failed write removes its temporary artifact when possible and never reports the mutation as applied.

### Baseline and normalization

The proposal binds two new exact command arrays:

- `baselineCommands`: executed after materialization and before the first mutation. Results are preserved even when nonzero so legitimate repair missions can start from a failing baseline.
- `normalizationCommands`: executed after each mutation plan and before final verification. A normalizer failure is a failed attempt. Any path it changes remains subject to the same writable-path and byte limits.

The Founder Command Center proposes only commands already permitted by the repository-specific mission builder. It does not infer or silently add a formatter after approval.

### Durable attempt evidence

Journal version 2 stores:

- baseline checks;
- an attempt record per iteration;
- plan digest;
- normalization and verification checks, saved after every command;
- changed paths and diff digest;
- start and completion timestamps; and
- structured cleanup evidence.

Command evidence stores the exact command, exit code, SHA-256 digest and byte count of the observed stdout bytes followed by observed stderr bytes, whether presentation was truncated, and a bounded redacted presentation. Synthetic process-error text is never added to the observed-byte digest. Credential-like text is removed before journal persistence or model reuse. Raw command output is never journaled.

Resume uses the latest persisted failed checks and unchanged proposal. Journal version 3 binds the exact proposal and approval into the event-chain root and revalidates that root binding before any resumed provider or workspace action. Earlier journals remain loadable for inspection and cleanup, but resume fails closed because they cannot prove the complete approval and command evidence.

### Verified cleanup

Cleanup returns structured evidence rather than a boolean. Before deletion it proves that the workspace resolves beneath the configured disposable root and has the expected executable-worker prefix. It then:

1. inspects Git worktree registration;
2. removes registration when present;
3. prunes stale worktree metadata;
4. removes the physical directory with bounded retries; and
5. independently verifies both registration absence and filesystem absence.

Cleanup is idempotent. A partially cleaned workspace can be discarded again. The runtime remains `recovery-ready` whenever either absence check fails; it never reports `stopped`, `completed`, or cleanup success without both proofs.

### Final checkpoint safeguards

Before candidate commit creation, the runtime rechecks:

- the unchanged approved base revision and candidate branch;
- all actual changed paths against the approved scope;
- final content and changed-byte limits;
- credential redaction denial;
- all normalization and verification exit codes;
- durable evidence completeness; and
- event-chain integrity.

No push, pull request, merge, deployment, credential, spending, public or LAN exposure, repository administration, or final Phase 0 graduation authority is added.

## Command Center changes

- Generate proposal-bound baseline and normalization commands.
- Tell the coding model to return digest-bound exact replacements, not complete updated files.
- Reconstruct completed and recovery views from the durable Core journal rather than relying only on in-memory results.
- Display complete command-result status and structured cleanup status without exposing raw sensitive output.

## Verification strategy

Write failing tests before implementation for:

1. unrelated-text corruption being structurally impossible;
2. stale file digests, duplicate replacement matches, overlaps, NUL content, and credential output being denied;
3. atomic-write failure preserving the original file;
4. baseline, normalization, and all verification results surviving journal reload;
5. resume receiving the previous failed checks;
6. output redaction retaining the raw digest and byte count;
7. partial Git-only cleanup remaining recoverable and succeeding on retry;
8. missing-directory but registered-worktree cleanup;
9. cleanup-root escape denial;
10. no candidate commit after incomplete evidence or any failed command; and
11. Command Center proposal, prompt, schema, restart reconstruction, and truthful UI behavior.

Run the focused Core and Command Center tests, then each repository's full pinned verification suite. No dependency installation, version change, lockfile change, commit, push, pull request, merge, or publication is authorized by this design.

## Rollback

Because this tranche is uncommitted local work, rollback is removal of the two isolated hardening worktrees after preserving non-secret failure evidence. Canonical `main`, the active Founder Command Center checkout, and running service data remain untouched.
