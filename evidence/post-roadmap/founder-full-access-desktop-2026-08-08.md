# Founder Full Access and Desktop Evidence — 2026-08-08

- Branch: `iris/founder-autonomous-operations`
- Base: `9be0c016569636160f74bacb18401f774ccc6c67`
- Core implementation commits: `11da6b1`, `72d1ee4`, `670b6b2`
- Focused contracts: access profile, exact-head delivery, Windows runner, live desktop interruption and audit.
- Rollback: revoke the session grant, stop the desktop runner, use history-preserving repository rollback, and clean the disposable workspace.
- Protected exclusions: credentials, spending, deployment/exposure, administration, force-push/history rewrite, destructive data work, elevation, and Phase 0 graduation.

Fresh WSL verification on the complete branch passed on 2026-08-08: formatting, lint, both TypeScript checks, 55 test files with 427/427 tests, the production build, and repository diagnostics all exited 0. Live startup and loopback smoke results remain a post-merge check and are not claimed here.
