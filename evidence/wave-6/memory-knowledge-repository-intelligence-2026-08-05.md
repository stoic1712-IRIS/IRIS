# Wave 6 Verification Evidence

**Date:** 2026-08-05

**Branch:** `iris/wave-6-memory-knowledge`

**Baseline:** `fab64776f336cbd7139321789e3cbb356efa1ac3`

## Implemented Scope

- IRIS-owned `@stoic-iris/memory` workspace package
- governed proposal, activation, conflict, supersession, sensitivity, category, and freshness behavior
- deterministic document chunks, citations, text retrieval, derived model-versioned embeddings, exact vector retrieval, and vector-disabled operation
- live file/package/dependency/test/build/protected-path repository map with citations
- PostgreSQL/pgvector migration and ordered rollback definitions
- repository baseline updated to require the memory package

## Automated Verification

The certified Ubuntu runtime used Node.js `24.19.0` and pnpm `11.20.0`. The monorepo build passed. Vitest reported 10 passing test files and 56 passing tests, including seven Wave 6 tests. The Wave 6 tests directly demonstrate:

- exact-digest activation and authority requirement;
- conflict detection and mandatory explicit supersession;
- preserved superseded history;
- category, sensitivity, and freshness scoping;
- deterministic chunks and citation-bearing retrieval;
- embedding replacement and vector-disabled text retrieval;
- repository dependency and protected-path explanation; and
- storage migration governance, audit, row-access, and rollback declarations.

## Repository Intelligence Proof

The live diagnostic inspected Git-visible files and workspace manifests and reported:

- 6 IRIS packages;
- 113 files at proof time;
- 10 test files;
- 7 internal dependency edges;
- explicit build files and protected governance paths; and
- repository citations for its claims.

The count includes the uncommitted Wave 6 files under final verification and is expected to remain structurally equivalent after commit.

## Disposable PostgreSQL and pgvector Proof

Image: `pgvector/pgvector@sha256:691673308c99d2161ba298736f3147f1f22d79de2fb7ec93ae9b4afcab870b62`

Observed versions: PostgreSQL `18.4`; pgvector `0.8.6`.

The proof ran with Docker network `none`, zero published ports, zero host mounts, a tmpfs data directory, 768 MiB memory, one CPU, a 256-process limit, and a fictional password. It passed schema constraints, transaction rollback, row-level public-only access for a restricted role, append-only audit capture, exact vector ordering, HNSW fixture recall against the exact result, HNSW index rebuild, embedding-model replacement, citation persistence, relational operation without vector retrieval, dump/restore, and restored-row verification.

The exact disposable container `iris-wave6-postgres-proof` was removed in `finally`. A post-removal exact-name query returned no container. No persistent volume or network was created.

## Limits

No persistent database was deployed. No production credential, host repository mount, Docker socket mount, external network, paid resource, large-scale approximate-index performance claim, or unrestricted worker memory role was introduced. The HNSW result is a bounded functional recall fixture; production scale and latency remain future operational benchmarks, and vectors remain non-authoritative.

## Gate Result

Passed. IRIS can explain the current repository with evidence, govern conflict-aware canonical memory changes, retrieve cited knowledge with or without vectors, and prevent workers from receiving unrestricted memory access.
