# IRIS Coordination Records

This directory contains the machine-readable contracts used to coordinate IRIS, Codex, Claude, and governed workers.

- `task.schema.json` binds an objective and exact authority, including an optional atomic Founder completion mandate.
- `handoff.schema.json` records a producer result and remaining gates.
- `review.schema.json` records an independent review of an exact result.

Live records belong under `.iris/coordination/tasks/`, `.iris/coordination/handoffs/`, and `.iris/coordination/reviews/`. Create the exact task record before material mutation. Files under `examples/coordination/` are non-authoritative examples and completed onboarding evidence only.

Schemas do not grant authority. A record must also comply with canonical governance and the current explicit Founder instruction.
