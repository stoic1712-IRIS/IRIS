# Multi-Agent Coordination Policy

**Status:** Version 1.0.0 canonical; version 1.1.0 proposed and pending Founder approval

**Version:** 1.1.0 (proposed)

## Purpose

This policy defines how the Founder, IRIS, Claude, and governed workers collaborate without creating competing sources of truth, overlapping mutation authority, hidden handoffs, or self-review.

The Founder approved version 1.0.0 as canonical on 2026-08-06. Version 1.1.0 replaces the co-primary Codex operator role with Claude as primary Founder operator and the Founder as the named independent reviewer, without weakening producer-reviewer separation or the Phase 0 boundary.

## Authority and Ownership

- The Founder retains final authority.
- IRIS Core remains the canonical owner of governance, memory contracts, planning, approvals, orchestration, and audit state.
- Models and coding agents are replaceable executors and reviewers. They do not become canonical memory owners.
- Claude is the primary Founder operator and may produce, deliver, or review a task when assigned, subject to workspace isolation and producer-reviewer separation for the exact material output.
- The Founder is the named independent reviewer of Claude's material output. Claude may review the output of IRIS, a governed worker, or another assigned agent operator, and may never review its own.
- The canonical repository and verified provider state prevail over private conversation history or model memory.
- Technical access does not imply authorization.

## Required Roles

Every material task assigns distinct roles:

| Role      | Responsibility                                          | Prohibition                                            |
| --------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Issuer    | Defines objective, scope, risk, and authority           | Cannot conceal material scope changes                  |
| Producer  | Creates the bounded implementation or artifact          | Cannot independently approve its own material output   |
| Reviewer  | Independently inspects the exact producer revision      | Cannot alter the reviewed revision while certifying it |
| Publisher | Performs separately authorized protected GitHub actions | Cannot publish a different payload or target           |
| Founder   | Approves protected or canonical actions                 | Approval must remain exact and auditable               |

One actor may hold multiple roles only when canonical policy permits it, but producer and independent reviewer must remain separate for material changes.

## Founder Completion Mandate

The Founder may authorize a bounded objective as one atomic transaction by using an explicit completion instruction such as “finish this objective to completion,” “complete all of this cycle,” or equivalent wording that clearly names the objective.

Unless the Founder narrows the scope, a completion mandate authorizes the assigned co-primary operator to:

1. inspect and research the objective;
2. create an isolated `iris/<bounded-purpose>` branch and worktree;
3. make bounded local changes;
4. run applicable formatting, lint, type, test, build, security, recovery, and acceptance checks;
5. perform bounded repair within the same objective;
6. stage only explicitly reviewed paths;
7. create accurate commits;
8. push the exact non-force feature branch;
9. create and update a pull request;
10. obtain independent review from the other co-primary operator or an approved reviewer;
11. repair material findings within scope;
12. merge after required checks and review pass;
13. synchronize local canonical branches;
14. verify remote equality; and
15. safely clean disposable worktrees and temporary non-canonical artifacts.

The mandate avoids repeated Founder prompts for those included intermediate steps. Every action remains bound to the named objective, repositories, non-force history, verification requirements, and recorded evidence.

A completion mandate does not infer authority for deployment, public or LAN exposure, spending, paid-resource creation, credential creation or disclosure, repository or organization administration, access-control or visibility changes, destructive data operations, force-push, history rewriting, deletion of canonical evidence, or unrelated work. Those effects require explicit wording in the Founder objective.

If an unlisted external effect is genuinely necessary for completion, the operator reports one consolidated blocker and requests the minimum additional authority once rather than prompting piecemeal.

## Workspace Isolation

1. Each objective uses one dedicated branch and worktree per producing agent.
2. Two agents must not mutate the same worktree concurrently.
3. A review occurs in a clean worktree at the exact revision recorded in the task or handoff.
4. Unrelated user changes must remain outside the task worktree.
5. Dependencies, services, credentials, and provider resources remain prohibited unless the task authorizes them exactly.

Branches retain the canonical `iris/<bounded-purpose>` format. The task and handoff records identify the producer; branch naming does not confer authority.

## Coordination Records

Material work uses machine-readable records governed by the schemas under `.iris/coordination/`:

- **Task:** objective, authority, risk, bases, paths, commands, prohibitions, acceptance criteria, and publisher.
- **Handoff:** exact producer result, changed files, verification, evidence, limitations, rollback, and protected actions remaining.
- **Review:** exact reviewed revision, independent findings, verification, verdict, and disagreement state.

The records must use immutable commit identifiers or digests when those exist. A chat summary may explain a record but cannot replace it.

## Execution Flow

1. Verify the Founder objective and canonical sources.
2. Create a task record against exact base revisions.
3. Assign one producer and isolated worktree.
4. Perform only permitted actions and paths.
5. Produce a handoff; when a valid completion mandate exists, continue through its included delivery actions without separate stage-by-stage prompts.
6. Assign an independent reviewer at the exact result revision or patch digest.
7. Preserve findings and repair only within existing authority; otherwise request reapproval.
8. Obtain distinct protected authorization where required.
9. Allow one explicitly designated publisher per repository to execute the exact authorized action so co-primary operators do not race the same remote branch.
10. Verify remote equality, evidence, rollback readiness, cleanup, and resource termination.

## Disagreement Protocol

- Material disagreement is recorded, not averaged away.
- The producer may respond with evidence but cannot mark its own finding resolved.
- The reviewer may revise a finding only with an explicit rationale.
- IRIS compares the task, evidence, and canonical policy and presents the Founder with the disagreement and recommended resolution.
- Protected publication stops while a material finding remains unresolved unless the Founder explicitly accepts the recorded risk.

## Access Progression

New operators may be validated through these levels without treating lower validation levels as permanent capability restrictions:

1. **Orientation:** repository reads, canonical-source mapping, no mutation.
2. **Independent review:** read-only diff inspection and approved verification commands.
3. **Bounded implementation:** exact paths in a dedicated worktree with independent review.
4. **Branch publication:** push only an exact approved branch and revision.
5. **Pull-request operation:** create or review an exact PR under separate authority.

Claude's steady state is full operational capability across repository, terminal, GitHub, research, browser, connector, implementation, verification, and delivery work. Breadth of capability is not authority: the Founder remains the independent reviewer, and no capability grants Claude the right to certify its own output.

Repository administration, secrets, billing, organization management, force-push, history rewriting, destructive cleanup, and deployment are not silently granted by capability parity.

## Phase 0 Graduation

During the final Development Independence graduation, every external coding agent is audit-only. This binds Claude and any other external agent operator without exception. They must not modify the repository or perform IRIS's self-upgrade steps. IRIS must complete the governed workflow herself for the result to satisfy Phase 0.

## Founder Decision

### Version 1.0.0

- [x] Approved as canonical policy
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:** Cristofer Stoic Arellano

**Decision date:** 2026-08-06

### Version 1.1.0 — Founder as named independent reviewer

- [ ] Approved as canonical policy
- [ ] Approved with amendments
- [ ] Rejected for revision

**Founder:** Cristofer Stoic Arellano

**Decision date:** pending

Version 1.0.0 remains canonical until this decision is recorded. Producer: Claude, which cannot approve this amendment.

**Approved version or commit:** Version 1.0.0; activation commit `ed7f58b1cab2f9b7d41e693ac0216a422494d8d5`

**Notes:** Approved by exact typed Founder instruction for publication in both repositories.
