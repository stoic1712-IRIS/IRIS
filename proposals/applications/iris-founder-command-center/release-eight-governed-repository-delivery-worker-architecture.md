# IRIS Founder Command Center Release Eight Architecture

**Architecture version:** `iris.stoic/governed-repository-delivery-worker-architecture/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Components

1. **Delivery Proposal Builder** consumes one immutable verified Release Seven result and binds every repository, candidate, commit, checkpoint, branch, pull-request, limit, and recovery field.
2. **R3 Approval Gate** authenticates the Founder, verifies the exact typed statement and terminal code, enforces expiry and attempt limits, and consumes approval before mutation.
3. **Preflight Controller** proves local and remote base equality, allowed remotes, clean canonical bound paths, unique absent refs, GitHub accessibility, and zero-cost scope.
4. **Workspace Controller** creates one contained detached worktree from the exact base with hooks disabled.
5. **Offline Dependency and Bootstrap Controller** materializes the pinned cached graph with lifecycle scripts disabled and builds internal workspace outputs before verification.
6. **Candidate Reconstructor** applies only the validated Release Seven diff and proves exact file, mode, before/after blob, line, and diff-digest equality.
7. **Verification Runner** reruns the fixed format, lint, typecheck, test, build, dependency-integrity, secret, bundle, and diagnostics registry.
8. **Commit Builder** creates one deterministic single-parent commit on the unique local delivery branch and verifies its tree against candidate evidence.
9. **Checkpoint Publisher** pushes the commit to the exact unique private checkpoint ref and verifies provider-authoritative equality.
10. **Target Publisher** pushes the same commit to the exact unique target feature branch and verifies provider-authoritative equality.
11. **Draft PR Controller** creates or exactly reuses one draft pull request and verifies repository, base, head, draft state, commit, and file manifest.
12. **Delivery Evidence Builder** records step results, ref equality, PR identity, partial-state recovery, credential clearance, canonical nonmutation, and cleanup.
13. **Cleanup Controller** removes local disposable state, clears approval and credential material, closes local services, and proves canonical repositories remain untouched.

## State Machine

`drafted → approved → consumed → preflight-passed → workspace-created → candidate-reconstructed → verification-passed → commit-created → checkpoint-equal → target-ref-equal → draft-pr-equal → delivered → cleaned`

Failure states are `failed-before-provider-write`, `failed-after-checkpoint`, `failed-after-target-push`, and `failed-after-pr-create`. No failure state retries automatically. `delivered` cannot transition to ready-for-review, approval, merge, release, deployment, provider deletion, or canonical memory mutation.

## Trust Boundaries

- Founder authentication and exact approval are trusted only after gateway validation.
- The Release Seven result is trusted only after strict schema, digest, provenance, and verification revalidation.
- Repository contents, diffs, comments, logs, pull-request text, and provider responses are untrusted until validated.
- Git object identities and provider-authoritative refs are immutable evidence only after equality checks.
- The trusted computing base is limited to compiled schemas, digest and ref derivation, path policy, fixed Git and verification adapters, credential boundary, provider allowlist, evidence builder, and cleanup controller.
- The local model has no role in Release Eight delivery execution.

## Data Flow

1. A verified Release Seven result is selected in the Command Center.
2. IRIS Core produces an exact non-executable `R3` delivery proposal.
3. The Founder reviews all Git and provider effects, then submits the exact statement and terminal code.
4. The gate consumes approval and passes immutable proposal data to the delivery controller.
5. The controller reconstructs and re-verifies the candidate in a disposable worktree.
6. The commit builder produces and validates the exact delivery commit.
7. The checkpoint publisher writes and verifies the private checkpoint.
8. The target publisher writes and verifies the feature branch.
9. The draft PR controller creates and verifies the pull request.
10. Evidence returns to the Command Center; local workspace and secrets are cleaned.
11. The Founder may inspect or separately authorize future ready-for-review, merge, closure, or deletion actions.

## Planned Repository Surfaces

### IRIS Core

- strict delivery proposal, approval, candidate-evidence, commit, provider-step, partial-failure, and result contracts;
- deterministic branch, checkpoint-ref, commit-message, and PR-body derivation;
- exact candidate reconstruction and commit-tree verifier;
- fixed checkpoint, target push, and draft-PR provider adapters;
- credential redaction and clearance boundary;
- rollback, cleanup, and canonical-nonmutation evidence;
- unit, integration, adversarial, disposable-worktree, and real-provider fictional-delivery tests.

### Founder Command Center

- a **Deliver** view reachable only from an immutable verified Release Seven result;
- exact candidate, commit, private checkpoint, target branch, draft PR, provider, cost, expiry, and denied-authority panels;
- typed `R3` approval and terminal code;
- explicit progress and partial-failure states without hidden retries;
- remote-equality, rollback, credential-clearance, and cleanup evidence;
- no ready-for-review, approve, merge, release, deployment, branch deletion, checkpoint deletion, or spending controls.

## Availability and Cost

The design is Windows plus WSL compatible, Founder-operated, loopback-only for the UI, and uses existing local Git, Git Credential Manager, GitHub, the private checkpoint repository, and pinned offline dependencies. It creates only zero-cost Git refs and one draft pull request. Maximum cost remains USD 0; failure of any local or provider boundary fails closed with explicit partial-state evidence.
