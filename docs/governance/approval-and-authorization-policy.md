# Approval and Authorization Policy

**Status:** Canonical

**Version:** 1.0.0

## Purpose

This policy operationalizes Founder authority and the R0-R4 risk model. It governs how authority is requested, bound, consumed, rejected, revoked, and evidenced.

## Governing Rules

1. Unspecified authority is denied.
2. Technical capability does not create permission.
3. Approval is bound to an exact action, payload, target, executor, and validity condition.
4. Risk may be raised by evidence but never lowered to avoid approval.
5. Separate protected actions require separate approval unless an approved policy defines one atomic transaction.
6. A producer cannot independently approve its own material output.

## Action Classes

| Class | Typical activity | Required authority |
| --- | --- | --- |
| R0 | Read, inspect, explain, diagnose, compare | Existing read authority; no state change |
| R1 | Reversible local edit in an authorized workspace | Explicit task approval with bounded paths |
| R2 | Canonical artifacts, dependencies, shared configuration, material repairs | Exact proposal, explicit approval, verification, rollback evidence |
| R3 | Stage, commit, push, merge, publish, deploy, message, spend, use credentials, change access or visibility | Authenticated typed approval for each protected action and target |
| R4 | Governance bypass, silent self-authorization, uncontrolled destruction, secret exfiltration, evidence falsification | Deny; exceptional recovery only when constitutionally permitted and explicitly approved |

## Approval Record

Every material approval record must contain:

- approval identifier;
- authenticated approver identity when available;
- request and proposal identifiers;
- risk class;
- exact action and payload digest or immutable reference;
- target repository, branch, environment, provider, recipient, or resource;
- allowed executor and tools;
- preconditions and exclusions;
- issued time and expiry or one-time-use status;
- required verification and cleanup; and
- final consumption, rejection, expiry, or revocation state.

## Typed Protected Approvals

The following actions are distinct approval types: stage, commit, push, pull-request creation, merge, deploy, public release, repository-visibility change, branch-protection change, secret use, financial commitment, paid-resource creation, destructive action, canonical governance adoption, and identity amendment.

Approval to draft does not authorize staging. Staging does not authorize committing. Committing does not authorize pushing. Pushing does not authorize merging or deployment.

## Founder Full Access

An authenticated Founder session may issue one visible, time-bounded, revocable Full-access grant for registered ordinary capabilities. The grant is bound to the Founder session and gateway boot, is invalid after disable, logout, gateway restart, or Windows restart, and must remain interruptible and audit-chained.

Full access does not include credential disclosure, spending, deployment, public or LAN exposure, repository or account administration, force-push or history rewriting, destructive data operations, elevation, or Phase 0 graduation. Those effects remain separately protected regardless of technical availability or prior convenience.

## Proposal Requirements

R2 and R3 proposals must state:

- objective and why the action is needed;
- exact files, data, systems, and external effects;
- intended commands or equivalent operations;
- security, privacy, license, cost, and availability implications;
- tests and independent verification;
- rollback and cleanup;
- changes that would trigger reapproval; and
- evidence destination.

## Reapproval Triggers

Reapproval is mandatory when payload, target, approach, dependency, exposure, cost, risk, or protected scope materially changes; when approval expires or is consumed; or when repair exceeds the original proposal.

## Denial and Revocation

Denied actions must not be retried through another tool, worker, provider, or phrasing. Revocation stops new work as soon as safely possible and triggers evidence preservation and cleanup.

## Emergency Recovery

Emergency recovery must still be bounded, documented, explicitly approved, history-preserving where possible, and independently verified. Emergency status does not authorize secret exposure, evidence destruction, or unlimited scope.

## Verification

Authorization verification must reject altered payloads, mismatched targets, expired or consumed approvals, unauthorized executors, missing preconditions, and invalid signatures or authentication context when those mechanisms exist.

## Founder Decision

- [x] Approved as canonical policy
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:**

**Decision date:**

**Approved version or commit:**

**Notes:**
