# Wave 9 Capability Learning Engine and Worker Foundry

**Status:** Canonical and implemented; Wave 9 decision gate passed
**Decision gate:** An approved external pattern produces an original IRIS-native worker; the worker operates after the external system is removed; generated workers cannot approve or activate themselves.

## Purpose

Wave 9 converts reviewed patterns into IRIS-owned capability proposals without copying an external system's code, identity, authority, or runtime dependency. It does not grant coding authority and does not complete Phase 0 Development Independence.

## Capability Learning Engine

Every candidate intake fixes its exact source identity, revision, license, review timestamp, proposed patterns, and a no-copied-source-code assertion. A review must independently cover verified provenance and immutable revision, license permission and obligations, security risks and runtime requirements, mapping to an IRIS-owned capability and boundary, and implementation-neutral principles.

The engine returns `build`, `adopt`, or `reject`. Missing provenance, disallowed license use, unacceptable security risk, or absent capability mapping fails closed to `reject`. `Adopt` is reserved for a capability that genuinely requires a governed external runtime. `Build` means original IRIS software can implement the reviewed principles.

## Worker Foundry

The Foundry accepts only a `build` decision paired with a typed Founder approval whose digest exactly matches the reviewed decision. It produces a validated Worker Factory specification, instructions, minimum permissions, tool bindings, hardened container settings, test templates, documentation and registry proposals, and an immutable worker digest.

Every generated result is a proposal with `requires-founder-approval` status, no external runtime dependencies, and literal false values for self-approval and self-activation. The Foundry has no activation path: its activation method always fails closed. Wave 9 remains limited to read-only workers; the later sovereign-development gate controls coding authority.

## Acceptance Worker

The approved OpenClaw bounded-execution pattern from ADR-004 and Wave 5 is used only as a pattern source. The original IRIS-native `Evidence Verifier` reads a bounded fictional manifest, validates SHA-256 evidence entries, and returns citations. It contains no OpenClaw code, protocol, package, process, or runtime dependency.

The disposable proof requires the prior OpenClaw proof container to be absent, then runs the Evidence Verifier in a digest-pinned Node container with no network, read-only root and mounts, non-root identity, dropped capabilities, `no-new-privileges`, and bounded resources. It removes the container and workspace and verifies zero remaining Wave 9 resources.

## Boundaries

- External systems never become governance, approval, memory, registry, or worker-identity owners.
- Pattern approval is distinct from worker activation approval.
- Generated artifacts cannot enlarge permissions, delegate, self-approve, self-activate, or obtain coding authority.
- Runtime providers remain replaceable and canonical state remains repository-owned.
- Phase 0 remains incomplete until its permanent deployed Founder-operated multi-file self-upgrade criterion is satisfied without Codex or Claude modifying the repository during that graduation workflow.

## Verification

Schema, rejection, recommendation, approval-binding, originality, self-activation-denial, external-runtime-independence, lifecycle, cleanup, and full repository verification are covered. Exact results are preserved in `evidence/wave-9/capability-learning-worker-foundry-2026-08-05.md`.
