# Model Gateway and Ollama Adapter Specification

**Status:** Canonical and implemented; deterministic and live Ollama verification passed

**Version:** 0.1.0

**Wave:** 3 - Shared Contracts and IRIS Kernel

## Purpose and Scope

This slice establishes an IRIS-owned model-runtime boundary and a local-only Ollama adapter. It normalizes structured requests, validated outputs, model provenance, usage, timeouts, cancellation, context limits, safe errors, secret filtering, and immediate model unload behavior.

## Requirements

- Keep model runtimes replaceable behind an IRIS-owned adapter contract.
- Accept only strict, canonical requests with an exact request identifier, model, messages, JSON Schema, generation limits, and timeout.
- Restrict the initial Ollama adapter to `localhost` or `127.0.0.1` over HTTP.
- Use the Ollama chat endpoint with non-streaming responses, disabled thinking, a caller-supplied JSON Schema, deterministic temperature and seed, explicit context size, and explicit keep-alive.
- Treat provider envelopes and model content as untrusted until independently validated.
- Reject a response from a model other than the exact requested model.
- Return provider/model provenance, token counts, duration metrics, and an explicit declaration that the model has no authority.
- Reject recognized private keys, provider tokens, and credential assignments before making a provider call.
- Normalize provider rejection, unavailability, timeout, malformed envelopes, invalid JSON, schema failure, and model mismatch without exposing raw sensitive content.

## Exclusions

This slice does not grant a model identity, memory ownership, approval authority, tool execution, streaming, tool calls, fallback routing, cloud access, LM Studio support, model installation, secrets access, canonical persistence, deployment, or external actions.

## Verification

Root formatting, zero-warning linting, strict type-checking, unit tests, build, and diagnostics must pass. Tests cover the exact provider payload, valid structured output, malformed JSON, schema mismatch, model mismatch, timeout, provider rejection, secret blocking before transport, and local-endpoint enforcement. A separate live local check must prove structured output from the approved `qwen3:8b` runtime without retaining prompts or hidden reasoning.

## Rollback and Completion Gate

Revert the bounded merge commit before integrated Kernel behavior. Completion requires deterministic verification, public-safe live evidence, a clean committed tree, sensitivity review, remote equality, conflict-free pull-request review, and Founder-approved merge.
