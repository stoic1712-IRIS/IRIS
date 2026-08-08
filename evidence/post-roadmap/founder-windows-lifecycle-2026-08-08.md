# Founder Windows Lifecycle Evidence — 2026-08-08

- Branch: `iris/founder-autonomous-operations`
- Base: `9be0c016569636160f74bacb18401f774ccc6c67`
- Core implementation commits: `493b4e5`, `37767fb`, `c45fea8`
- Health gates: gateway `4174`, neural voice `8765`, SearXNG `8888`, Ollama `11434`, all loopback.
- Startup: non-elevated per-user Scheduled Task; canonical workflow entrypoint; no embedded credentials.
- Greeting: one Core marker per boot, consumed and spoken by the Command Center only after voice health.
- Rollback: `runtime stop`, then `runtime remove-startup`; only owned state/processes/task are targeted.

Fresh WSL verification on the complete branch passed on 2026-08-08: formatting, lint, both TypeScript checks, 55 test files with 427/427 tests, the production build, and repository diagnostics all exited 0. Startup registration, restart, and loopback smoke remain post-merge checks and are not claimed here.
