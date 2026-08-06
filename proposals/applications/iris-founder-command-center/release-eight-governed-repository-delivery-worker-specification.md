# IRIS Founder Command Center Release Eight Specification

**Specification:** `iris.stoic/governed-repository-delivery-worker/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Objective

Release Eight enables IRIS to deliver one previously verified Release Seven candidate through a uniquely named private checkpoint, feature branch, commit, push, and draft pull request after a new authenticated, exact, one-time Founder approval. It converts noncanonical candidate evidence into reviewable GitHub history without granting merge, review-submission, release, deployment, spending, self-approval, or standing repository authority.

## Preconditions

- The target repository is exactly `stoic1712-IRIS/IRIS` or `stoic1712-IRIS/iris-founder-command-center`.
- The input is an immutable Release Seven result with verdict `verified`, all required checks passed, canonical and GitHub mutation flags `false`, and a validated cleanup state.
- The proposal binds the target repository, full base revision, expected local and remote `main` revisions, Release Seven proposal and result identifiers, candidate diff digest, exact changed-file manifest, before and after digests, verification evidence digest, checkpoint repository, unique checkpoint ref, unique delivery branch, commit message, draft pull-request title and body digest, expiry, cleanup plan, and USD 0 limit.
- The bound base revision equals local `main` and `origin/main` at proposal creation and again immediately before execution. Drift fails closed and requires a fresh proposal.
- The validated candidate diff contains only existing approved UTF-8 text-file modifications supported by Release Seven version 1. Deletes, renames, mode changes, binaries, links, submodules, workflows, dependency manifests, lockfiles, generated bundles, and Git internals remain denied.
- The exact private checkpoint repository `stoic1712-IRIS/IRIS-checkpoints` exists and the GitHub credential is supplied only to the delivery controller through the approved ephemeral provider boundary.

## Protected Action

Repository delivery is an `R3` external Git and provider mutation. Activation requires an authenticated, exact, one-time, digest-bound Founder approval plus the terminal-bound one-time code. Approval is consumed before any workspace, Git ref, checkpoint, branch, commit, push, or pull-request mutation. A stale, altered, replayed, or mismatched approval fails closed.

## Inputs

- One immutable verified Release Seven result and its exact evidence digest.
- One target repository and immutable base revision.
- At most 20 modified text files and 2,000 changed lines.
- One unique `iris/delivery-<proposal-suffix>` feature branch that does not exist locally or remotely.
- One unique `checkpoint/release-eight-<proposal-suffix>` private checkpoint ref that does not exist remotely.
- One fixed commit message, draft pull-request title, and bounded pull-request body derived from verified evidence.
- The fixed Release Seven verification command identifiers.
- Maximum runtime 900 seconds, maximum retained local workspace 30 minutes, and maximum cost USD 0.

## Delivery Method

1. Revalidate the proposal, typed statement, terminal code, expiry, one-time state, and immutable Release Seven evidence.
2. Verify target identity, clean canonical bound paths, local and remote `main` equality, exact base ancestry, allowed remotes, and nonexistence of the proposed local and remote refs.
3. Consume approval before all mutating work and record the pre-execution canonical, remote, credential, and provider-state evidence.
4. Create one uniquely named disposable worktree from the exact base revision with Git hooks disabled and no upstream.
5. Materialize the pinned dependency graph offline with frozen lockfile and lifecycle scripts disabled, then run the fixed workspace bootstrap build.
6. Reconstruct the exact candidate from the Release Seven unified diff using a fixed Git operation; verify the diff digest, file allowlist, before and after digests, changed-line budget, modes, and prohibited-content policy before and after application.
7. Rerun every fixed verification check. Any failure stops before commit or provider mutation and requires a new proposal.
8. Create the exact unique local delivery branch and one commit with fixed author identity, message, parent, tree, and disabled hooks. Verify the commit tree reproduces the approved candidate manifest exactly.
9. Push the exact commit to the unique private checkpoint ref first and verify provider-reported remote equality.
10. Push the same commit to the unique feature branch in the target repository and verify provider-reported remote equality.
11. Create one draft pull request targeting `main` with the exact approved title and evidence-bound body. Verify its repository, base, head, draft state, commit, and changed-file manifest.
12. Emit bounded delivery, remote-equality, rollback, and cleanup evidence; delete the disposable local worktree and temporary local branch; clear credentials and approval material.

## Output

The result contains `delivered`, `failed-before-provider-write`, or `failed-after-partial-provider-write`; the base and delivery commit; candidate and commit-tree digests; checkpoint repository and ref; target branch; draft pull-request number and URL; per-step verification; remote-equality proofs; any compensating-action state; rollback instructions; canonical working-tree proof; credential-clearance proof; and cleanup state.

`delivered` means the verified candidate exists as a private checkpoint, remote feature branch, and draft pull request. It does not mean approved, canonical, merged, released, deployed, or adopted into `main`.

## Failure and Compensation

- Failure before provider mutation deletes the disposable workspace and local temporary ref and leaves GitHub unchanged.
- If the private checkpoint succeeds but the target push fails, the checkpoint is preserved as rollback evidence and the result records the partial state; no automatic retry occurs.
- If the target branch succeeds but draft pull-request creation or verification fails, the branch and checkpoint remain immutable and the result records exact manual recovery instructions; IRIS does not silently delete remote evidence.
- Remote branch deletion, checkpoint deletion, pull-request closure, repair, retry, scope change, or delivery from a new base requires a separately approved proposal.

## Success Criteria

- Exact approval is consumed before any mutation.
- The reconstructed diff and commit tree exactly match the verified Release Seven evidence.
- All fixed checks pass again before commit and push.
- The private checkpoint and target feature ref equal the exact local delivery commit.
- Exactly one draft pull request targets the bound `main` revision and contains only the approved files.
- Canonical worktrees, indexes, configurations, hooks, and `main` refs are not modified by the delivery worker.
- Credentials remain outside model and browser content, are process-memory-only, and are cleared after use.
- Local workspaces and processes are cleaned; cost remains USD 0.

## Explicit Non-Goals

- Merge, rebase, squash, force-push, review submission, branch-protection change, release, deployment, or canonical-memory mutation.
- Model access to Git, shell, credentials, GitHub, network, provider APIs, or delivery decisions.
- Delivery of unverified, expired, altered, retained-only, or scope-expanded candidates.
- Dependency, lockfile, workflow, generated-bundle, binary, mode, rename, or deletion changes in version 1.
- Persistent credentials, background workers, startup registration, public or LAN exposure, paid resources, or spending.
