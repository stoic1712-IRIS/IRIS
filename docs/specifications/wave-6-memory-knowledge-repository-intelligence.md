# Wave 6 Memory, Knowledge, and Repository Intelligence

**Status:** Implemented and verified

**Date:** 2026-08-05

## Outcome

Wave 6 gives IRIS an owned, governed boundary for canonical memory, citation-bearing knowledge retrieval, and evidence-grounded repository explanation. PostgreSQL and pgvector remain replaceable persistence and retrieval mechanisms behind that boundary.

## Canonical Memory

Memory is separated into `founder`, `project`, `operational`, `knowledge`, `capability`, `model`, and `audit` categories. Every candidate begins as a proposal with provenance, citations, confidence, sensitivity, and a deterministic content digest. Canonical activation requires the exact digest, a named authority, and a valid timestamp.

If a different canonical value already exists for the same category and key, IRIS reports a conflict. Activation is blocked until the proposal explicitly identifies the record it supersedes. Superseded history is retained. Queries return canonical records only and enforce category, maximum-sensitivity, and freshness scopes; a worker is not granted unrestricted memory access.

## Knowledge Engine

Documents are split deterministically at paragraph boundaries. Every chunk retains its document, ordinal, source reference, and content digest. Text retrieval works independently of vectors and returns the cited source chunks.

Embeddings are derived records linked to the source digest and embedding model. Replacing a model's embedding set rebuilds that derived view without changing source truth. Exact cosine retrieval is deterministic, and callers can disable vector retrieval while retaining text search.

## Repository Intelligence

The repository map inventories tracked files, workspace packages, internal dependency edges, test files, build configuration, and protected governance paths. Every file and package entry carries a repository citation. The live diagnostic explains the current repository from actual Git and package-manifest state rather than from a static narrative.

## Durable Storage Boundary

ADR-002's PostgreSQL 18.4 and pgvector 0.8.6 decision is represented by an IRIS-owned migration with:

- relational state and sensitivity constraints;
- one canonical record per category and key;
- citation and provenance storage;
- append-only memory-change audit capture;
- row-level security policy;
- model-versioned derived vector records; and
- ordered rollback statements.

The disposable proof uses the recorded image digest with network disabled, no published ports, no host mounts, bounded memory, CPU, and process count, and fictional credentials. It verifies transactions, row access, audit capture, exact vector ordering, relational reads without vector search, backup/restore, and teardown. It does not deploy persistent infrastructure.

## Gate

Wave 6 is complete when all repository checks pass, the live repository explanation contains citations, governed memory rejects conflicts and excess access, disposable PostgreSQL/pgvector verification passes, and the proof container is absent afterward.

## Rollback

Before a dependent wave relies on these interfaces, revert the Wave 6 merge commit. The migration rollback drops derived embeddings before chunks and memory tables. Preserve exports and audit/history evidence before any production rollback. Because this wave deploys no persistent service, no live database migration is required now.
