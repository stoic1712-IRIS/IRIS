# Repository Repair Approval Lifecycle Implementation Plan

1. Bind the exact Core and Command Center base revisions in the coordination task.
2. Add failing Core tests for a ten-minute valid window and exact expiry rejection.
3. Add failing gateway tests for automatic stale-state retirement and live-state preservation.
4. Add failing UI-state tests for countdown and replacement behavior.
5. Implement the smallest Core expiry change, gateway lifecycle helper, and UI recovery state.
6. Run focused verification, repair regressions without broadening scope, then run both full suites.
7. Record exact evidence, stage exact paths, commit, push non-force, create pull requests, inspect checks and diffs, merge only if verification passes, synchronize both canonical mains, clean worktrees, restart IRIS, and smoke-test proposal creation without approving or executing it.
