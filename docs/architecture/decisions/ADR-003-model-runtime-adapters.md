# ADR-003: Replaceable Model Runtime Adapters

**Status:** Founder-approved; pending canonical commit

**Date:** 2026-08-04

**Owners:** Founder and IRIS Core

**Related wave/capability:** Waves 2 and 3; Model Gateway

## Context

Models provide replaceable reasoning. They may not own identity, memory, governance, approval, or audit. The workstation already proves local structured inference through Ollama and has LM Studio available as a stopped laboratory/fallback runtime.

## Decision Drivers

Local operation, structured output, explicit timeouts, model lifecycle control, GPU use, privacy, provider portability, stable IRIS-owned errors, and no provider-specific authority leakage.

## Options Considered

- Ollama 0.32.5: verified local GPU inference, simple local API, MIT source; API is stable by convention but not strictly versioned.
- LM Studio CLI commit 71bd99c: useful visual laboratory and local compatible APIs; proprietary product terms and network behavior require continuing review.
- llama.cpp rolling build `b10276`: MIT and low-level GGUF control; rapidly changing build pins and compatibility behavior add maintenance.
- vLLM 0.26.0: Apache-2.0 high-throughput Linux serving; unnecessary complexity for the current single-workstation workload.

## Decision

Use an IRIS-owned model-gateway contract. Retain Ollama as the proposed primary local adapter and LM Studio as the proposed laboratory/fallback adapter. Defer llama.cpp until low-level deployment requirements appear and vLLM until measured concurrency or multi-GPU requirements appear.

The contract must normalize model identity, input/output schemas, structured-output validation, streaming, tool requests, timeout, cancellation, context limits, usage, errors, health, load/unload, and evidence. Provider output is untrusted until validated.

## Consequences

IRIS can replace runtimes without moving authority. Some provider-specific features remain behind capability negotiation. Model files require separate identity, license, provenance, and benchmark records.

## Verification

Run the same structured request against every enabled adapter; reject malformed output; test timeout, cancellation, unavailable model, context overflow, provider shutdown, secret filtering, and fallback without changing canonical identity or policy.

## Rollback and Removal

Disable the adapter, unload models, remove provider configuration and model files only through an approved exact target list, verify no process or port remains, and run contract tests with the remaining provider.

## Approval

Founder approval granted in the Founder conversation on 2026-08-04: "I approve ADR-001 through ADR-004 as the architectural direction for coordination, canonical memory, model runtime adapters, and bootstrap orchestration." Canonical effect remains pending repository commit. No new runtime installation was authorized.

## Supersession

None.
