# Wave 3 Integrated Decision Gate Evidence

**Status:** Decision gate passed and evidence canonical

**Date:** 2026-08-04

**Branch:** `iris/wave-3-integrated-decision-gate`

**Base revision:** `0cc7384f2b67142e3245354af34c496cfbc74788`

## Scope

Verify the governed pipeline from objective intake through identity, policy, approval boundaries, Model Gateway reasoning, and cryptographically chained audit evidence. The proof permits no protected-action execution, secret access, cloud access, paid resource, deployment, or external effect.

## Deterministic Results

- An authenticated read-only objective remained R0, received `allow`, reached the Model Gateway, returned zero model authority, and produced a complete correlated audit chain.
- R1 and unapproved R3 objectives stopped at `awaiting-approval` without invoking the model.
- R4 was denied before model invocation.
- An exact R3 approval was evaluated, consumed once, and recorded before governed model reasoning.
- An altered approval target was denied and preserved in the audit chain.
- Provider unavailability, invalid structured output, and timeout were returned as safe failures and recorded as `ModelFailed` events.
- All audit events used one canonical correlation identifier and exact cryptographic predecessor digests.

The full repository gate passed with 35 of 35 tests across 7 files, formatting, zero-warning linting, strict type-checking, build, and diagnostics.

## Live Integrated Result

The actual `IntegratedDecisionGate` and `OllamaAdapter` executed against the local Windows Ollama loopback service. A diagnostic-only injected transport carried the adapter's HTTP request across the WSL/Windows loopback boundary without changing the adapter's local-only endpoint policy.

```json
{
  "status": "completed",
  "riskClass": "R0",
  "authorization": "allow",
  "provider": "ollama",
  "model": "qwen3:8b",
  "output": {
    "status": "ready",
    "model": "qwen3:8b",
    "authority": "none"
  },
  "modelAuthority": "none",
  "auditEventTypes": [
    "ObjectiveClassified",
    "PermissionEvaluated",
    "ModelResponded",
    "DecisionCompleted"
  ],
  "auditCorrelationIds": [
    "request_02936f3a-8b5c-7def-8abc-0123456789ab"
  ],
  "auditChainComplete": true,
  "usage": {
    "inputTokens": 53,
    "outputTokens": 24,
    "totalDurationNanoseconds": 2438954500,
    "loadDurationNanoseconds": 2142394800
  }
}
```

The request used `think: false`, temperature and seed zero, a strict JSON Schema, and `keep_alive: 0`. `ollama ps` was empty afterward, proving zero active model resources.

## Failures and Repairs

1. The first provider-failure test normalized a gateway error as a generic integration error because separate source and built-package module instances made `instanceof` unreliable. Repair replaced it with a strict structural guard limited to canonical gateway error codes and public-safe scalar detail values.
2. Earlier Model Gateway evidence recorded the WSL/Windows loopback boundary. This proof preserved the boundary and used an injected diagnostic-only Windows loopback transport rather than broadening Ollama exposure.

## Limitations

- Identity authentication and signature verification remain later deployed-boundary responsibilities.
- Audit and approval state remain in memory; durable canonical persistence belongs to later waves.
- The gate reasons about an approved protected request but never executes the protected action.
- Coordination publication, retry, dead-letter handling, durable replay, streaming, fallback routing, LM Studio, and cloud runtimes remain outside Wave 3.
- Phase 0 is not complete. Its permanent graduation criterion still requires a genuinely deployed Founder-operated multi-file self-upgrade without Claude or Codex modifying the repository during that graduation workflow.

## Rollback and Cleanup

Revert the bounded future merge commit before Wave 4 behavior. The live model was unloaded immediately, no paid resource was created, and provider-authoritative process state showed zero active models.

## Completion Assessment

The canonical Wave 3 decision-gate conditions passed. The complete package was reviewed and merged through PRs #5-#10 and is an ancestor of canonical `main`.
