# IRIS Founder Command Center Release Eight Interface Design

**Interface version:** `iris.stoic/governed-repository-delivery-worker-interface/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Founder Journey

1. Open a Release Seven result whose verdict is `verified` and choose **Draft delivery proposal**. This is read-only and creates no Git or provider state.
2. Inspect the exact candidate provenance, repository, base, files, diff digest, repeated verification plan, commit, private checkpoint, target branch, draft pull request, credential boundary, expiry, partial-failure behavior, rollback, and denied authority.
3. Confirm that the target branch and checkpoint ref are unique and absent and that local `main` equals remote `main`.
4. Type the exact `R3` approval statement and enter the terminal-bound one-time code.
5. Choose **Deliver verified candidate** once. The interface immediately shows approval as consumed.
6. Observe explicit phases: preflight, workspace creation, offline materialization, bootstrap, reconstruction, verification, commit creation, private checkpoint push, checkpoint equality, target push, target equality, draft PR creation, PR verification, evidence, and cleanup.
7. Review the final commit, checkpoint ref, feature branch, draft PR, changed files, verification, equality, rollback, and cleanup evidence.
8. Leave the draft PR for human review. Any ready-for-review, merge, closure, deletion, retry, or repair action requires a new proposal outside Release Eight.

## Eligibility Panel

The panel shows:

- Release Seven proposal/result identifiers, verdict, evidence digest, and cleanup state;
- repository and exact base, local `main`, and remote `main` revisions;
- candidate diff digest, changed files, before/after digests, changed-line count, and verification results;
- explicit reasons when a result is stale, altered, unverified, unsupported, or otherwise ineligible.

Only an eligible immutable result enables proposal drafting.

## Delivery Proposal Panel

The panel must show:

- proposal identifier, digest, creation time, expiry, and `R3` classification;
- exact private checkpoint repository and unique ref;
- exact target repository, unique feature branch, base, and commit message;
- draft pull-request title, body digest, base/head mapping, and maintainers-modify policy;
- repeated verification commands, workspace root, time and size limits, USD 0 cost;
- credential source class and redaction policy without displaying a credential;
- checkpoint-first ordering, remote-equality requirements, partial-failure states, cleanup, rollback, and all excluded authority;
- exact typed approval statement and terminal-code field.

Any mismatch, expiry, attempt-limit failure, revision drift, existing ref, provider denial, or unavailable credential replaces activation with a fail-closed explanation and **Draft fresh proposal**.

## Execution Panel

The execution panel presents one deterministic phase at a time, elapsed time, bounded sanitized output, completed and pending provider writes, and cancellation availability. It never displays credentials, unrestricted logs, hidden reasoning, arbitrary commands, mutable remote URLs, or model-generated provider instructions. Cancellation stops at the next safe boundary and records any provider state already created.

## Result Panel

The result panel shows:

- verdict and exact last completed state;
- base, delivery commit, commit tree, and candidate diff digests;
- private checkpoint repository/ref and provider equality proof;
- target feature branch and provider equality proof;
- draft pull-request number, URL, repository, base, head, commit, and changed-file verification;
- every repeated verification command and bounded result;
- canonical repository and `main` nonmutation proof;
- credential-clearance, local cleanup, and port/process state;
- partial-failure recovery and history-preserving rollback instructions.

The result always labels `delivered` as noncanonical and unmerged.

## Safety and Accessibility

- Use plain language alongside risk, commit, and digest detail.
- Require explicit typed approval and code; disable replay after consumption.
- Make provider mutations visually distinct and list their exact order before activation.
- Never imply that a checkpoint, branch, commit, or draft PR is approved or canonical.
- Use semantic headings, keyboard-accessible controls, visible focus, status announcements, copyable identifiers, and text labels independent of color.
- Keep the authenticated local-session indicator, `R3` warning, candidate-only provenance, USD 0 boundary, and zero-merge-authority statement visible.

## Explicitly Absent Controls

Release Eight contains no ready-for-review, review-submission, approval, merge, rebase, squash, force-push, branch-protection, workflow-dispatch, release, deployment, provider deletion, checkpoint deletion, dependency-version, lockfile, startup-registration, public-exposure, spending, self-approval, or canonical-memory controls.
