# IRIS Founder Command Center Release Five Security Contract

**Contract version:** `iris.stoic/founder-operational-control/v1`

**State:** Proposed; non-executable; pending exact Founder approval

## Objective

Release Five adds the first governed local action path: the Founder may create one bounded mission proposal, review an exact read-only worker specification, authenticate a one-time typed activation approval, run that worker through the existing Ollama adapter, inspect cited output, and prove termination and zero residual resources.

## Authority Boundary

IRIS may plan and propose but may never approve itself. Mission proposal creation is ephemeral and reversible. Worker activation is a protected action and requires an exact, one-time, digest-bound Founder approval. The browser, gateway, model, and worker possess no standing approval authority. Any mismatch, replay, expiry, altered specification, unavailable model, or cleanup failure denies activation.

## Founder Authentication

The Release Four loopback session remains required. For activation, the gateway additionally displays a cryptographically random, two-minute, single-use terminal approval code bound by HMAC-SHA-256 to the exact proposal digest. The Founder must enter both that code and the exact typed statement shown by IRIS. Five failed attempts invalidate the gate. Successful evaluation consumes it before model invocation. Approval values remain process-memory-only and never enter URLs, environment variables, logs, bundles, evidence, or Git.

## First Worker Envelope

- Class: read-only specialist.
- Provider and model: local Ollama `qwen3:8b` through the canonical adapter.
- Objective: inspect allowlisted canonical IRIS status and return a structured, citation-bearing readiness report.
- Read scope: fixed canonical specifications and evidence selected by IRIS Core.
- Write scope: none.
- Shell, Docker, provider, Git-write, network, delegation, and permission-expansion authority: none.
- Network exception: IRIS Core may call only exact loopback Ollama endpoint `http://127.0.0.1:11434`; the worker receives no general network tool.
- Maximum runtime: 120 seconds; maximum output: 64 KiB; one invocation; temperature zero; thinking disabled.
- Cost: zero dollars; no paid or external provider resource.
- Cleanup: terminate worker and model request, discard ephemeral mission/session state, verify no worker process, verify Command Center ports close after shutdown, and report Ollama residency without falsely claiming provider-wide zero.

## Mutation Surface

Allowed ephemeral routes are limited to mission proposal creation, activation approval evaluation, status read, and local cancellation. They may mutate only in-memory Release Five session state. Repository, canonical memory, persistent mission, approval registry, provider, deployment, startup, worker registry, and filesystem mutation routes remain absent.

## Required Verification

Tests must prove strict schemas; exact host/origin/fetch-metadata/session/CSRF checks; proposal digest stability; terminal-code and typed-statement binding; expiry, failed-attempt, replay, and altered-proposal denial; approval consumption before invocation; exact Ollama destination; structured output and citation validation; timeout and malformed/provider-failure handling; zero repository writes; cleanup; secret and bundle scans; formatting; zero-warning lint; strict type checking; full tests; production builds; and dependency audit in both repositories.

## Reapproval Triggers

Any different model, objective class, permissions, read or write path, tool, network destination, timeout, cost, persistence, deployment, identity mechanism, repository effect, external provider, or repair outside this contract requires a new proposal and exact approval.

## Rollback

History-preserving reverts restore Release Four. Runtime rollback terminates the gateway, Core, worker, and active Ollama request; clears in-memory proposal and approval state; closes ports `4174` and `4181`; and verifies no repository or persistent state changed.
