# IRIS Founder Command Center Release Seven Interface Design

**Interface version:** `iris.stoic/governed-repository-repair-worker-interface/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Founder Journey

1. Open **Review** and select a validated Release Six finding, or enter an exact bounded defect statement.
2. Choose **Draft repair proposal**. This performs no write and grants no execution authority.
3. Inspect repository, exact revision, finding digest, editable files, context files, verification commands, model, limits, expiry, cleanup behavior, and excluded authority.
4. Copy or type the exact approval statement and enter the terminal-bound one-time code.
5. Choose **Generate candidate repair** once. The interface immediately shows that approval was consumed.
6. Observe explicit states: preparing workspace, materializing pinned offline dependencies, assembling context, generating candidate, validating files, running named verification, building evidence, awaiting Founder review, or cleaning up.
7. Review the candidate diff and verification evidence.
8. Choose one safe outcome: **Reject and clean up**, **Keep for review until expiry**, or **Draft a new repair iteration**. No canonical or GitHub mutation control is present.

## Proposal Panel

The panel must show:

- proposal identifier, digest, creation time, expiry, and `R2` classification;
- repository and full base and expected remote revisions;
- defect or finding digest and cited files/lines;
- editable and read-only context manifests;
- allowlisted verification command names;
- maximum files, lines, bytes, runtime, retained duration, and USD 0 cost;
- model and exact loopback endpoint;
- exact offline/frozen/no-lifecycle dependency materialization and explicit denied authority;
- exact approval statement and terminal-code field.

Any mismatch, expiry, failed attempt limit, revision drift, or remote mismatch replaces activation controls with a fail-closed explanation and a **Draft fresh proposal** option.

## Execution Panel

Execution status must be deterministic and bounded. It may show phase, elapsed time, current verification command identifier, output truncation notice, and cleanup deadline. It must not expose hidden chain-of-thought, secrets, raw credentials, unrestricted logs, shell commands, or mutable paths. Cancellation requests terminate safely and transition to cleanup.

## Result Panel

The result panel shows:

- verdict: `verified`, `needs-repair`, or `failed`;
- exact base revision and candidate diff digest;
- changed-file manifest with before/after digests;
- unified diff with bounded, syntax-highlighted content;
- model rationale labeled advisory;
- each verification command, exit state, duration, and bounded sanitized output;
- warnings and denied-content events;
- proof that canonical refs, index, working tree, remotes, and GitHub state were unchanged;
- candidate expiration and cleanup state;
- exact new proposal statement if another repair iteration is recommended.

## Safety and Accessibility

- Use plain language alongside risk and digest details.
- Never represent `verified` as approved, canonical, merged, released, or deployed.
- Require explicit confirmation before early cleanup of a retained candidate; cleanup is otherwise automatic at expiry.
- Disable repeat activation after approval consumption.
- Use keyboard-accessible controls, visible focus, semantic headings, status announcements, and text labels independent of color.
- Keep the local read-only session indicator and zero-independent-authority statement visible.

## Explicitly Absent Controls

Release Seven contains no stage, commit, push, pull-request, review-submission, merge, branch-protection, deployment, credential, provider-resource, spending, dependency-version or lockfile change, online installation, lifecycle-script, startup-registration, public-exposure, or canonical-memory controls.
