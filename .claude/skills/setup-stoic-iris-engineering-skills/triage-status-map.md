# Triage status

The skills speak in terms of five triage roles. This repository has no label vocabulary — work state lives in the `status` enum of `.iris/coordination/task.schema.json`. Map roles onto that enum rather than introducing a second, unbound source of state.

| Role in mattpocock/skills | Task-record state                   | Meaning                                                     |
| ------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `needs-triage`            | `draft`                             | Recorded, not yet bounded or authorized                     |
| `needs-info`              | `blocked`                           | Waiting on the Founder or on verified state before bounding |
| `ready-for-agent`         | `approved` with an agent `executor` | Bounded and authorized; Claude or Codex may produce         |
| `ready-for-human`         | `approved` with a human `executor`  | Bounded and authorized; only the Founder may perform it     |
| `wontfix`                 | `cancelled`                         | Will not be actioned; the record stays as history           |

`in_progress` and `completed` have no triage-role equivalent. They belong to execution: `in_progress` once a producer holds the worktree, `completed` only after the record's `acceptance_commands` have actually passed.

## Authorization is the second axis

`status` says how far the work has travelled. It never says how much is permitted — `risk_class` and `authorization_mode` do, and `approved` alone authorizes nothing beyond what the record's `allowed_paths`, `permitted_actions`, and `completion_actions` name.

So `ready-for-agent` means the record is bounded well enough for a producer to start, not that the producer may stage, commit, push, open a pull request, or merge. Those stay R3 protected actions gated on a Founder completion mandate that names them.

## Moving a record

Editing a task record is a repository mutation: exact paths, no broad staging, and the same governed lifecycle as any other change. Where the state you want to record contradicts canonical governance, stop and report the conflict instead of relabelling around it.

Phase 0 graduation records are the exception with no agent state at all. Where `phase0_graduation` is `true`, Claude and Codex are audit-only and move nothing.
