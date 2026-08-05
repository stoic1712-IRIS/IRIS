# ADR-002: Canonical Memory and Vector Search

**Status:** Founder-approved; pending canonical commit

**Date:** 2026-08-04

**Owners:** Founder and IRIS Core

**Related wave/capability:** Waves 2 and 6; Canonical Memory and Knowledge Engine

## Context

IRIS needs durable governed memory, relational constraints, provenance, auditability, conflict and supersession records, transactional updates, backup, export, and semantic retrieval. Vector search is a derived retrieval aid and must not become the owner of canonical truth.

## Decision Drivers

Transactional integrity, local-first operation, mature backup and restore, access control, portable data, permissive licensing, TypeScript support, predictable removal, and minimum service count.

## Options Considered

- PostgreSQL 18.4 with pgvector 0.8.6: one durable system for relational state, JSON, audit, outbox, row security, exact search, HNSW, and IVFFlat.
- Qdrant 1.18.3: strong specialist retrieval, filtering, WAL, snapshots, and scoped API keys; self-hosting is insecure by default and needs a separate service.
- LanceDB: embedded and attractive for rebuildable local indexes, but not selected as canonical transactional memory.
- Chroma 1.5.9: functional local service but currently overlaps selected capabilities.
- Deep Lake 4.5.2: broad multimodal and training-data functionality beyond the demonstrated requirement.

## Decision

Select PostgreSQL 18.4 as the proposed canonical durable store and pgvector 0.8.6 as the proposed initial vector extension. Keep embeddings and vector indexes derived, rebuildable, model-versioned, and linked to canonical source records.

Evaluate Qdrant only if measured scale, latency, filtering, or recall requirements exceed pgvector. LanceDB may be evaluated for disposable repository indexes. Defer Chroma and Deep Lake.

## Consequences

IRIS gains transactional governance and retrieval with one primary service. Approximate indexes require recall benchmarks and cannot be treated as authoritative. PostgreSQL administration, migration, backup, role design, and secret handling become required capabilities.

## Verification

Test schema constraints, transactions, row-level access, append-only audit behavior, backup/restore, migration rollback, exact vector results, approximate recall, embedding-model replacement, index rebuild, citations, deletion/supersession, and operation with vector search disabled.

## Rollback and Removal

Export canonical tables in documented open formats, preserve schema and migration history, restore the prior checkpoint, drop the optional extension only after dependent indexes are removed, delete disposable volumes, and verify no orphan service remains.

## Approval

Founder approval granted in the Founder conversation on 2026-08-04: "I approve ADR-001 through ADR-004 as the architectural direction for coordination, canonical memory, model runtime adapters, and bootstrap orchestration." Canonical effect remains pending repository commit. Installation into the canonical stack was not authorized.

## Supersession

None.
