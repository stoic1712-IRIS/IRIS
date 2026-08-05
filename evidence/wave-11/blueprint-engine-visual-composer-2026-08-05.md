# Wave 11 Blueprint Engine and Visual Composer Evidence

**Status:** Decision gate passed

**Date:** 2026-08-05

## Evidence Summary

- Strict portable blueprint contracts cover nodes, edges, profiles, locks, networks, secret references, resources, cost, security, provenance, health, and approval state.
- Architecture validation detects port collisions, missing secrets/networks/endpoints, exposure violations, cycles, capacity/cost breaches, absent locks, and security-policy failures.
- Docker Compose compilation is deterministic and produces no secret values.
- Rollback and removal manifests are generated from the same parsed blueprint.
- The command-line example compiled successfully before visual acceptance.
- The visual model passed blueprint-to-canvas round-trip, diff, and ELK layout tests.
- The application provides canvas editing, inspection, operational status, approval visibility, and independent exports while withholding deployment authority.
- The canonical `iris-local-stack` blueprint and the independent `fictional-disposable-bookshop` application blueprint both pass schema and architecture validation.
- The fictional application compiles deterministically with an internal network, immutable image and source locks, secret references without values, bounded test resources, and non-root security policy.
- Exact cleanup coverage includes the Compose project, both fictional services in reverse dependency order, the private network, and the secret reference; rollback preserves repository history.

## Selected Visual Dependencies

React Flow `12.11.2` (MIT) supplies accessible graph interaction and custom nodes/edges. ELK.js `0.12.0` (EPL-2.0) supplies layered layout behind an adapter. React `19.2.8`, React DOM `19.2.8`, Vite `8.2.0`, and the React Vite plugin `6.0.5` are exact pins. The canonical JSON format is independent of all visual dependencies.

## Verification Commands

The Wave 11 test files, both blueprint fixtures, CLI compiler, and full `pnpm verify` suite were executed with the certified WSL Node `24.19.0` and pnpm `11.20.0` toolchain. Generated CLI output was disposable and excluded from canonical source. The fictional application uses the reserved `example.invalid` domain and creates no external application, repository, credential, deployment, or paid resource.
