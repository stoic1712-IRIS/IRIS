# Wave 11 Blueprint Engine and Visual Composer

**Status:** Canonical and implemented; Wave 11 decision gate passed

**Date:** 2026-08-05

## Purpose

Wave 11 turns infrastructure intent into a portable, reviewable IRIS document. The typed backend is authoritative; the visual composer is one replaceable editor over that model.

## Delivered Boundaries

- `@stoic-iris/blueprints`: strict schemas, environment profiles, architecture validation, Compose compilation, and rollback/removal manifests.
- `@stoic-iris/visual-composer`: drag-and-drop canvas, palette, typed connection editor, inspector, provenance/license/security/resource views, health and log surface, diff, approval visibility, ELK layout, and export controls.
- CLI compiler: parses the canonical JSON schema, refuses invalid input, and emits deterministic Compose, rollback, and removal artifacts.
- Example: a private-network IRIS API and pgvector memory-store blueprint with digest locks and secret references.

## Governance and Safety

Blueprints contain secret identifiers, never secret values. Public exposure, capacity, cost, security posture, dependency cycles, references, and immutable locks are validated before compilation. The UI may request review but cannot approve itself, deploy, push, or mutate canonical repository history. Generated output is review material until a separately authenticated execution gate authorizes action.

## Profiles

Development, test, staging, and production have explicit CPU, memory, storage, GPU, node, public-port, and cost ceilings. A profile changes validation limits and compiler metadata; it never silently grants network or secret authority.

## Portability

The JSON blueprint—not React Flow state or Docker Compose—is canonical. UI conversion preserves typed edge data. Layout is isolated behind an adapter. Compiler outputs can be deleted and regenerated. Additional targets can implement the same parsed blueprint contract.

## Acceptance

Acceptance requires passing schema and policy tests, deterministic compiler tests, visual-model round-trip and diff tests, ELK layout proof, a successful CLI compile, the production UI build, and the repository-wide verification suite.
