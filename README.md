# IRIS

IRIS is a sovereign, Founder-governed cognitive operating system for governed AI engineering, capability learning, development, verification, deployment, and independent application creation.

This repository is governed by the STOIC-IRIS Governing Architecture, Canonical Development Roadmap, and Master Build Bible.

## Founder local runtime

The canonical local workflow owns runtime health, startup, recovery, and status:

```powershell
node scripts/workflow/iris-workflow.mjs runtime status --json
node scripts/workflow/iris-workflow.mjs runtime start --json
node scripts/workflow/iris-workflow.mjs runtime restart --json
node scripts/workflow/iris-workflow.mjs runtime repair --json
node scripts/workflow/iris-workflow.mjs runtime install-startup --json
```

The stack remains loopback-only. Founder Full access covers registered ordinary capabilities for the current authenticated session; credentials, spending, deployment/exposure, administration, force-push/history rewrite, destructive operations, elevation, and Phase 0 graduation remain separately protected.
