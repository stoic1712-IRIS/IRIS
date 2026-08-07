# IRIS Coordination Records

This directory contains the machine-readable contracts used to coordinate IRIS, Codex, Claude, and governed workers.

- `task.schema.json` binds an objective and exact authority, including an optional atomic Founder completion mandate.
- `handoff.schema.json` records a producer result and remaining gates.
- `review.schema.json` records an independent review of an exact result.

Schemas do not grant authority. A record must also comply with canonical governance and the current explicit Founder instruction.
