# Wave 9 Capability Learning and Worker Foundry Evidence — 2026-08-05

## Result

The Wave 9 decision gate passed on branch `iris/wave-9-capability-learning-worker-foundry`.

The Capability Learning Engine accepted the previously approved, provenance-pinned, MIT-reviewed, security-reviewed OpenClaw bounded-execution pattern and recommended an original IRIS build. The Worker Foundry produced a read-only Evidence Verifier proposal with instructions, minimum permissions, tool bindings, hardened container settings, tests, documentation, and registry output. No source code was copied and the proposal declares zero external runtime dependencies.

## Gate Evidence

| Canonical requirement | Evidence |
| --- | --- |
| Candidate intake | Exact OpenClaw repository identity, source revision `0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`, version `2026.7.1-2`, MIT license, and extracted patterns are schema-bound. |
| Provenance review | Identity and revision must both be verified or the engine returns `reject`. |
| License review | Pattern use must be reviewed and permitted or the engine returns `reject`. No external code was copied. |
| Security review | Unreviewed or unacceptable risks return `reject`; runtime dependence changes the recommendation to `adopt`. |
| Capability mapping and extraction | The bounded-execution pattern maps to IRIS-owned evidence verification with fixed permissions, termination, and cleanup principles. |
| Build/adopt/reject recommendation | Deterministic tests exercise all three dispositions and failure cases. |
| Worker generation | The Foundry emits a validated worker, reasoning, permission policy, tools, container settings, tests, documentation, and registry proposal. |
| External system removed | The proof refuses to start if the prior OpenClaw proof container exists. With it absent, the original Evidence Verifier completed successfully. |
| No self-approval or activation | Proposal status remains `requires-founder-approval`; both capabilities are literal false and `activate()` always throws. |

## Automated Verification

The Wave 9 suite contains ten focused tests. The complete repository verification passed with 13 test files and 86 tests. Formatting, linting, type checking, all tests, all package builds, and repository diagnostics passed.

## Disposable Runtime Proof

Command: `scripts/diagnostics/wave-9-worker-foundry.ps1`

Runtime image: `node@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43`.

```json
{
  "external_system": "absent",
  "external_container": "iris-wave5-openclaw-proof",
  "native_worker": "worker_evidence-verifier",
  "runtime": "iris-native",
  "checked": 2,
  "citations": ["evidence:wave-9/decision.json", "evidence:wave-9/worker-proposal.json"],
  "result": "passed"
}
```

```json
{"cleanup_verified":true,"remaining_wave9_containers":0,"remaining_workspaces":0}
```

No credential, external account, public port, persistent volume, named network, model call, deployment, or paid resource was created.

## Rollback

Revert the Wave 9 merge commit before dependent Wave 10 work exists. This removes Wave 9 while preserving all Wave 8 history. No external state migration is required because Wave 9 owns no persistent service or canonical data outside Git history.

## Phase Boundary

Wave 9 completion is not Phase 0 completion. The permanent Development Independence graduation still requires the genuine deployed Founder-operated multi-file self-upgrade, remote-equality, rollback, cleanup, and provider-authoritative zero-resource proof, performed by IRIS without Codex or Claude modifying the repository during the graduation workflow.
