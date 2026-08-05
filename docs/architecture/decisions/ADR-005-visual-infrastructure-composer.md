# ADR-005: Portable Blueprint Engine and Visual Composer

**Status:** Canonical; Wave 11 implementation and decision gate verified

**Date:** 2026-08-05

**Owners:** Founder and IRIS Core

**Related wave/capability:** Wave 11; Blueprint Engine and Visual Infrastructure Composer

## Context

IRIS needs a provider-neutral way to design, validate, review, export, remove, and roll back infrastructure without allowing a canvas, cloud provider, or deployment format to become the authority. The roadmap requires the backend engine and command-line proof before a visual interface.

## Decision

The canonical artifact is the strict `iris.stoic/v1` JSON blueprint owned by `@stoic-iris/blueprints`. It records profiles, immutable source and image locks, networks, secrets by reference, resources, cost, security, provenance, health, nodes, and typed edges. Validation is independent from presentation and detects missing dependencies, secret and network references, port collisions, public exposure, dependency cycles, capacity and cost breaches, absent locks, and security-policy violations.

Docker Compose is the first compiler target. Compilation is deterministic and produces rollback and removal manifests. It never deploys and never reads secret values. Approval state is visible but cannot be self-granted by the composer.

The visual editor uses React Flow `12.11.2` with ELK.js `0.12.0` layered layout. React Flow was selected for custom nodes and edges, keyboard and screen-reader support, viewport culling, and MIT licensing. ELK provides deterministic layered, orthogonal, compound-graph-capable layout behind an IRIS-owned adapter. The blueprint JSON remains exportable without either library.

## Alternatives Considered

- A bespoke canvas would increase accessibility, interaction, selection, zoom, and maintenance risk before the graph model is proven.
- Cytoscape.js is strong for graph analysis and large networks but is less aligned with editable application-node forms and handles.
- Rete.js is oriented toward executable node editors; IRIS needs an infrastructure document editor whose output remains declarative and provider-neutral.
- Provider-native designers would couple canonical state and exports to one deployment vendor.

## Consequences

The CLI, UI, and future API share one validation/compiler boundary. Visual dependencies are removable. Large graphs can use viewport rendering and ELK layout, while the strict schema caps nodes and edges. Docker Compose is an export target, not the canonical model. Cloud and Kubernetes compilers can be added later without changing governance authority.

## Verification

Schema, validation, deterministic compilation, rollback/removal generation, canvas round-trip, diff, and layout receive automated tests. The complete workspace must pass formatting, linting, type checking, tests, build, and repository diagnostics. A command-line compile of the example blueprint must succeed before visual acceptance.

## Rollback and Removal

Delete the visual application and its dependencies without changing the blueprint package or stored blueprint JSON. Generated Compose resources are removed using the generated removal manifest. Restore the previous blueprint from the rollback manifest and recompile. No generated artifact authorizes deployment.

## Approval

Implementation is authorized by the Founder's instruction to complete Wave 11. Canonical publication still follows repository review and merge controls.
