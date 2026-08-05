import { describe, expect, it } from "vitest";

import {
  GovernedMemoryStore,
  KnowledgeIndex,
  buildRepositoryMap,
  chunkDocument,
  explainRepository,
  postgresMemoryMigration001,
  postgresMemoryMigration001Rollback,
  type MemoryAccess,
  type MemoryProposal,
} from "../packages/memory/src/index.js";

const createdAt = "2026-08-05T12:00:00-06:00";
const founder = {
  actorId: "identity_01936f3a-8b5c-7def-8abc-0123456789ab",
  actorType: "founder" as const,
  displayName: "Founder",
};

function proposal(overrides: Partial<MemoryProposal> = {}): MemoryProposal {
  return {
    memoryId: "memory_01936f3a-8b5c-7def-8abc-0123456789ab",
    category: "project",
    key: "architecture.memory",
    value: "PostgreSQL is the canonical durable memory store.",
    sensitivity: "internal",
    confidence: 1,
    citations: [
      "repository:docs/architecture/decisions/ADR-002-canonical-memory-and-vector-search.md",
    ],
    proposedAt: createdAt,
    provenance: {
      createdAt,
      createdBy: founder,
      sourceKind: "repository",
      sourceReference: "docs/architecture/decisions/ADR-002-canonical-memory-and-vector-search.md",
      contentDigest: `sha256:${"a".repeat(64)}`,
      parentEvidenceIds: [],
    },
    ...overrides,
  };
}

describe("Wave 6 governed canonical memory", () => {
  it("requires an exact proposal digest and authenticated authority to activate", () => {
    const store = new GovernedMemoryStore();
    const proposed = store.propose(proposal()).record;
    expect(() =>
      store.activate({
        memoryId: proposed.memoryId,
        contentDigest: `sha256:${"0".repeat(64)}`,
        authorizedBy: "Founder",
        authorizedAt: createdAt,
      }),
    ).toThrow(/digest/);
    const canonical = store.activate({
      memoryId: proposed.memoryId,
      contentDigest: proposed.contentDigest,
      authorizedBy: "Founder",
      authorizedAt: createdAt,
    });
    expect(canonical.state).toBe("canonical");
  });

  it("detects conflicts and requires explicit history-preserving supersession", () => {
    const store = new GovernedMemoryStore();
    const first = store.propose(proposal()).record;
    store.activate({
      memoryId: first.memoryId,
      contentDigest: first.contentDigest,
      authorizedBy: "Founder",
      authorizedAt: createdAt,
    });
    const conflictingInput = proposal({
      memoryId: "memory_11936f3a-8b5c-7def-8abc-0123456789ab",
      value: "A different store is canonical.",
    });
    const conflicting = store.propose(conflictingInput);
    expect(conflicting.conflicts).toHaveLength(1);
    expect(() =>
      store.activate({
        memoryId: conflicting.record.memoryId,
        contentDigest: conflicting.record.contentDigest,
        authorizedBy: "Founder",
        authorizedAt: createdAt,
      }),
    ).toThrow(/supersession/);

    const replacementInput = proposal({
      memoryId: "memory_21936f3a-8b5c-7def-8abc-0123456789ab",
      value: "PostgreSQL remains canonical after review.",
      supersedesMemoryId: first.memoryId,
    });
    const replacement = store.propose(replacementInput).record;
    store.activate({
      memoryId: replacement.memoryId,
      contentDigest: replacement.contentDigest,
      authorizedBy: "Founder",
      authorizedAt: createdAt,
    });
    expect(store.get(first.memoryId)?.state).toBe("superseded");
    expect(store.get(replacement.memoryId)?.state).toBe("canonical");
  });

  it("enforces category, sensitivity, and freshness scopes for workers", () => {
    const store = new GovernedMemoryStore();
    const stale = store.propose(
      proposal({ freshnessExpiresAt: "2026-08-05T11:00:00-06:00" }),
    ).record;
    store.activate({
      memoryId: stale.memoryId,
      contentDigest: stale.contentDigest,
      authorizedBy: "Founder",
      authorizedAt: createdAt,
    });
    const restricted = store.propose(
      proposal({
        memoryId: "memory_31936f3a-8b5c-7def-8abc-0123456789ab",
        category: "founder",
        key: "founder.private",
        sensitivity: "secret",
      }),
    ).record;
    store.activate({
      memoryId: restricted.memoryId,
      contentDigest: restricted.contentDigest,
      authorizedBy: "Founder",
      authorizedAt: createdAt,
    });
    const workerAccess: MemoryAccess = {
      principalId: "worker_fixture",
      categories: ["project"],
      maximumSensitivity: "internal",
    };
    expect(store.query({ evaluatedAt: createdAt }, workerAccess)).toEqual([]);
    expect(
      store
        .query({ evaluatedAt: createdAt, includeStale: true }, workerAccess)
        .map((item) => item.memoryId),
    ).toEqual([stale.memoryId]);
  });
});

describe("Wave 6 knowledge engine", () => {
  const chunks = chunkDocument({
    documentId: "adr-002",
    text: "Canonical memory is governed.\n\nEmbeddings are derived and rebuildable.",
    sourceReference:
      "repository:docs/architecture/decisions/ADR-002-canonical-memory-and-vector-search.md",
    maximumCharacters: 50,
    id: (ordinal) => `chunk-${String(ordinal)}`,
  });

  it("chunks deterministically and returns citation-bearing text results", () => {
    expect(chunks).toHaveLength(2);
    expect(
      chunkDocument({
        documentId: "adr-002",
        text: "Canonical memory is governed.\n\nEmbeddings are derived and rebuildable.",
        sourceReference: chunks[0]?.sourceReference ?? "",
        maximumCharacters: 50,
        id: (ordinal) => `chunk-${String(ordinal)}`,
      }),
    ).toEqual(chunks);
    const index = new KnowledgeIndex();
    index.ingest(chunks);
    expect(index.searchText("derived embeddings", 1)[0]).toMatchObject({
      chunkId: "chunk-1",
      sourceReference:
        "repository:docs/architecture/decisions/ADR-002-canonical-memory-and-vector-search.md",
    });
  });

  it("supports exact vector order, model replacement, and vector-disabled operation", () => {
    const index = new KnowledgeIndex();
    index.ingest(chunks);
    index.replaceEmbeddings("fixture-v1", [
      { embeddingId: "embedding-0", chunkId: "chunk-0", vector: [1, 0, 0] },
      { embeddingId: "embedding-1", chunkId: "chunk-1", vector: [0, 1, 0] },
    ]);
    expect(index.searchVector([0, 1, 0], "fixture-v1", 2).map((item) => item.chunkId)).toEqual([
      "chunk-1",
      "chunk-0",
    ]);
    index.replaceEmbeddings("fixture-v1", [
      { embeddingId: "embedding-new", chunkId: "chunk-0", vector: [0, 1, 0] },
    ]);
    expect(index.searchVector([0, 1, 0], "fixture-v1", 2).map((item) => item.chunkId)).toEqual([
      "chunk-0",
    ]);
    expect(index.searchVector([0, 1, 0], "fixture-v1", 2, false)).toEqual([]);
    expect(index.searchText("canonical", 1)).toHaveLength(1);
  });
});

describe("Wave 6 repository intelligence and durable schema", () => {
  it("explains packages, dependencies, tests, and protected paths with citations", () => {
    const map = buildRepositoryMap({
      files: [
        "package.json",
        "packages/memory/src/index.ts",
        "packages/kernel/package.json",
        "tests/wave-6-memory-knowledge.test.ts",
      ],
      packages: [
        {
          name: "@stoic-iris/kernel",
          path: "packages/kernel",
          dependencies: ["@stoic-iris/contracts"],
        },
        { name: "@stoic-iris/contracts", path: "packages/contracts", dependencies: [] },
      ],
      protectedPaths: ["docs/governance/constitution.md"],
    });
    const explanation = explainRepository(map);
    expect(map.dependencyEdges).toEqual([
      { from: "@stoic-iris/kernel", to: "@stoic-iris/contracts" },
    ]);
    expect(map.testFiles).toEqual(["tests/wave-6-memory-knowledge.test.ts"]);
    expect(explanation.summary).toContain("2 IRIS packages");
    expect(explanation.citations).toContain("repository:packages/kernel/package.json");
  });

  it("defines governed PostgreSQL, pgvector, audit, row access, and rollback controls", () => {
    expect(postgresMemoryMigration001).toMatch(/CREATE EXTENSION IF NOT EXISTS vector/);
    expect(postgresMemoryMigration001).toMatch(/CREATE UNIQUE INDEX iris_memory_one_canonical/);
    expect(postgresMemoryMigration001).toMatch(/iris_memory_change_audit/);
    expect(postgresMemoryMigration001).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(postgresMemoryMigration001Rollback).toMatch(/DROP TABLE IF EXISTS iris_memory/);
  });
});
