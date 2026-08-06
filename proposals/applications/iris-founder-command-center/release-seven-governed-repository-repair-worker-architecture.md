# IRIS Founder Command Center Release Seven Architecture

**Architecture version:** `iris.stoic/governed-repository-repair-worker-architecture/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Components

1. **Repair Proposal Builder** reads an immutable review result or Founder defect statement and constructs the exact `R2` proposal.
2. **Approval Gate** authenticates the Founder, binds the typed statement and terminal code to the proposal digest, limits failures, and consumes approval before any write.
3. **Workspace Controller** validates canonical and remote revisions and creates the unique disposable worktree.
4. **Offline Dependency Materializer** links only the pinned, cached lockfile graph with lifecycle scripts disabled.
5. **Context Assembler** reads bounded committed files and verification summaries, labels all content untrusted, and rejects prohibited data.
6. **Local Model Adapter** performs one structured `qwen3:8b` request over loopback with no tools.
7. **Candidate Validator** checks schemas, file identity, content, limits, secrets, and before/after digests.
8. **Candidate Writer** writes validated complete-file replacements only within the disposable worktree.
9. **Verification Runner** resolves fixed command identifiers and captures bounded results without network or model control.
10. **Evidence Builder** emits the exact candidate manifest, diff digest, verification results, and next approval statement.
11. **Cleanup Controller** terminates processes, unloads the model, deletes expired candidates, removes temporary branches, and proves canonical nonmutation.

## State Machine

`drafted → approved → consumed → workspace-created → dependencies-materialized → candidate-generated → candidate-validated → verification-running → verified | needs-repair | failed → reviewed | expired → cleaned`

No transition bypasses `approved` and `consumed`. `needs-repair` may transition only to a new `drafted` proposal. `verified` cannot transition directly to stage, commit, push, pull request, merge, deployment, or canonical memory mutation.

## Trust Boundaries

- Founder authentication and typed approval are trusted only after gateway validation.
- Git commits and Git-generated digests are immutable evidence; working-tree content is not trusted input.
- Repository text, review findings, logs, and model responses are untrusted.
- Compiled schemas, path policy, command registry, digest calculation, and cleanup verification form the trusted computing base.
- GitHub is read-only for remote-equality proof in Release Seven; no token is exposed to the model or worker.

## Data Flow

1. The Command Center requests proposal creation from IRIS Core.
2. IRIS Core returns the exact target, limits, exclusions, digest, expiry, and approval statement.
3. The Founder submits the exact statement and terminal code.
4. IRIS Core consumes approval and starts the Workspace Controller.
5. Committed context flows through the Context Assembler to the local model.
6. Structured replacements flow through the Candidate Validator before the Candidate Writer.
7. The Verification Runner evaluates the resulting candidate.
8. The Evidence Builder returns sanitized results to the Command Center.
9. The Founder may reject, allow expiry and cleanup, request a newly proposed repair iteration, or separately authorize future Git actions.

## Planned Repository Surfaces

### IRIS Core

- strict proposal, approval, candidate, verification, and result contracts;
- repair proposal and approval service;
- disposable workspace and candidate-write adapters;
- fixed verification-command registry;
- local model repair worker;
- cleanup and nonmutation evidence;
- unit, integration, adversarial, and real-model fictional-repair tests.

### Founder Command Center

- a Repair view linked from a Release Six finding or exact Founder defect statement;
- immutable target, file scope, commands, limits, expiry, and exclusions;
- exact typed approval plus terminal code;
- progress states without hidden retries;
- candidate diff, verification, warnings, cleanup deadline, and next-action controls;
- no buttons for stage, commit, push, merge, deployment, or provider mutation in Release Seven.

## Availability and Cost

The design is Windows plus WSL compatible, local-only, loopback-only, offline after dependencies already exist, and capped at USD 0. It creates no paid or provider resources. Failure of Ollama, Git, verification, or cleanup fails closed and leaves canonical repositories untouched.
