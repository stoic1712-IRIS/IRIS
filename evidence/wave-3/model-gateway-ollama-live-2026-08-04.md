# Wave 3 Model Gateway and Ollama Live Evidence

**Status:** Passed with recorded boundary limitation

**Date:** 2026-08-04

**Branch:** `iris/wave-3-model-gateway-ollama`

**Base revision:** `ad4850c0984e3af5593f4a4d43b5a7752d41afb5`

## Scope

Verify the IRIS-owned Model Gateway/Ollama adapter deterministically and prove that the installed local `qwen3:8b` runtime returns schema-constrained output declaring no authority. No cloud endpoint, secret, tool call, external action, or retained reasoning trace was permitted.

## Sources and Runtime

- Ollama chat API: `https://docs.ollama.com/api/chat`
- Ollama structured outputs: `https://docs.ollama.com/capabilities/structured-outputs`
- Ollama errors: `https://docs.ollama.com/api/errors`
- Node.js `24.19.0`
- pnpm `11.20.0`
- Ollama `0.32.5`
- Model `qwen3:8b`, local Ollama identifier `500a1f067a9f`

## Deterministic Verification

The repository verification gate passed after the adapter implementation:

- formatting: passed;
- zero-warning lint: passed;
- strict type-checking: passed;
- unit tests: 30 of 30 passed across 6 files;
- build: passed;
- repository diagnostics: passed.

Adapter tests covered the exact non-streaming Ollama payload, `think: false`, caller-supplied JSON Schema, temperature and seed zero, explicit context size, immediate unload, structured-output validation, malformed JSON, schema mismatch, model mismatch, timeout/cancellation, provider rejection, secret blocking before transport, safe errors, and local-endpoint enforcement.

## Live Local Provider Result

The live check sent the same bounded provider fields directly to the Windows loopback Ollama API because the WSL environment cannot reach the Windows loopback binding. The response was validated against an object schema with no additional properties.

```json
{
  "provider": "ollama",
  "response_model": "qwen3:8b",
  "status": "ready",
  "declared_model": "qwen3:8b",
  "authority": "none",
  "done": true,
  "done_reason": "stop",
  "input_tokens": 53,
  "output_tokens": 24,
  "total_duration_ns": 5820794500,
  "load_duration_ns": 5451773000
}
```

`keep_alive: 0` was supplied, and `ollama ps` was empty immediately after the response, proving that the model was unloaded.

## Failures and Repair

1. The first live adapter attempt from WSL failed closed with `PROVIDER_UNAVAILABLE` because Windows Ollama listens on the Windows loopback boundary, which WSL does not share on this workstation.
2. A Windows adapter launch then encountered mixed WSL/Windows generated package-link incompatibility. No source or lockfile corruption occurred. The live provider proof therefore used the exact payload directly through PowerShell rather than weakening the local-only endpoint restriction or changing Ollama exposure.

## Limitations

- Deterministic tests prove the adapter behavior; the live call proves the local provider and schema behavior. A single process did not exercise both together because of the recorded host/WSL loopback and generated-link boundary.
- Streaming, tool calls, fallback routing, LM Studio, cloud runtimes, real authentication, canonical persistence, and integrated Kernel orchestration remain outside this slice.
- This evidence does not complete Wave 3 or Phase 0.

## Rollback and Cleanup

Revert the bounded future commit to remove the adapter. The live request used no secret or paid resource. The model was unloaded immediately, and no provider resource remained active.
