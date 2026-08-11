# Issue tracker: IRIS coordination records

Objectives for this repository live as schema-bound JSON records under `.iris/coordination/`, not as GitHub Issues.

| Record  | Path                           | Schema                                   | Holds                                         |
| ------- | ------------------------------ | ---------------------------------------- | --------------------------------------------- |
| Task    | `.iris/coordination/tasks/`    | `.iris/coordination/task.schema.json`    | One bounded objective and its exact authority |
| Handoff | `.iris/coordination/handoffs/` | `.iris/coordination/handoff.schema.json` | A producer's result and remaining gates       |
| Review  | `.iris/coordination/reviews/`  | `.iris/coordination/review.schema.json`  | An independent review of an exact revision    |

A schema validates shape, never authority. A record is authoritative only when it also complies with canonical governance and the current Founder instruction.

## Conventions

- **Create a ticket** — write `.iris/coordination/tasks/<task-id>.json` against `task.schema.json`. `task_id` is lowercase kebab-case and matches the filename. Fill `objective`, `issuer`, `executor`, `assigned_role`, `risk_class`, `authorization_mode`, `base_revisions`, `allowed_paths`, `excluded_paths`, `acceptance_commands`, and `required_evidence` from verified state — an empty or guessed `allowed_paths` grants nothing.
- **Read a ticket** — read the task record, then its handoff and review records under the same `task_id`. The three together are the ticket's history.
- **List open work** — `node -e "const fs=require('fs');for(const f of fs.readdirSync('.iris/coordination/tasks')){const t=JSON.parse(fs.readFileSync('.iris/coordination/tasks/'+f,'utf8'));console.log(t.status.padEnd(18),t.task_id)}"`
- **Comment** — records carry no comment stream. Findings belong in the handoff or review record; disagreement is preserved as a finding and escalated, never averaged away.
- **Change state** — edit `status`, keeping the enum in `task.schema.json`. Editing a task record is itself a repository mutation and follows the same bounded-path lifecycle as any other change.

`authorization_mode` decides how much a record permits. `single_action` requires `completion_mandate_text: null` and an empty `completion_actions`; `completion_mandate` requires both to be populated, and its `completion_actions` are the only lifecycle steps that run without asking again.

## Where GitHub fits

GitHub is a delivery provider, not the tracker. `stoic1712-IRIS/IRIS` carries branches, pull requests, and checks; it does not hold the objective of record.

So a `#123` reference in a commit message is a pull request, not an issue. Resolve it with `gh pr view 123 --comments`, then find the objective by reading the `task_id` the pull request cites. If a commit cites no record, that is a finding worth reporting, not a gap to fill by inventing one.

Push, pull-request creation, and merge are R3 protected actions. Only the designated `publisher` for the objective performs them, and only where the task record names them.

## When a skill says "publish to the issue tracker"

Write the durable document first, then the record that authorizes acting on it:

- a spec goes to `docs/superpowers/specs/<YYYY-MM-DD>-<slug>-design.md`
- a plan goes to `docs/superpowers/plans/<YYYY-MM-DD>-<slug>.md`
- the task record at `.iris/coordination/tasks/<task-id>.json` points at that document and bounds the work

## When a skill says "fetch the relevant ticket"

Read `.iris/coordination/tasks/<task-id>.json`, plus any handoff and review sharing that `task_id`.

## Wayfinding operations

Used by `wayfinder`. `task.schema.json` sets `additionalProperties: false` and defines no dependency field, so blocking edges cannot live in a task record.

- **Map** — one plan document under `docs/superpowers/plans/`, holding the notes, decisions so far, and open fog.
- **Child ticket** — one task record per bounded decision or piece of work, listed in the map.
- **Blocking** — recorded in the map as `Blocked by: <task-id>, <task-id>` beneath each child. A child is unblocked when every blocker's record reads `status: "completed"`.
- **Frontier** — children in the map whose blockers are all completed and whose own status is `draft` or `approved`; first in map order wins.
- **Claim** — set the child's `executor` and move `status` to `in_progress`. One producer per objective and per worktree; check that no other operator already holds it.
- **Resolve** — record the outcome in the handoff, move the task record to `completed` once its acceptance commands have actually passed, and append the decision to the map.
