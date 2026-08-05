import type { InfrastructureBlueprint } from "@stoic-iris/blueprints";

const digest = `sha256:${"1".repeat(64)}`;

export const sampleBlueprint: InfrastructureBlueprint = {
  apiVersion: "iris.stoic/v1",
  id: "iris-local-stack",
  name: "IRIS Local Sovereign Stack",
  profile: "development",
  approvalStatus: "draft",
  networks: [{ id: "iris-private", internal: true }],
  secrets: [{ id: "database-password", provider: "environment" }],
  policy: {
    allowPublicExposure: false,
    requireDigestLocks: true,
    requireNonRoot: true,
    maxHourlyCostUsd: 0,
  },
  metadata: {
    createdBy: "Founder",
    createdAt: "2026-08-05T17:30:00-06:00",
    sourceRevision: "f0ed121ec34253b9a427fd859e1108052b0b1d1f",
  },
  nodes: [
    {
      id: "iris-api",
      name: "IRIS API",
      kind: "gateway",
      image: { repository: "ghcr.io/stoic-iris/api", digest },
      command: [],
      environment: { NODE_ENV: "development" },
      ports: [{ container: 3000, host: 3000, protocol: "tcp", exposure: "host" }],
      networks: ["iris-private"],
      secrets: ["database-password"],
      resources: { cpuCores: 2, memoryMiB: 2048, storageGiB: 0, gpuCount: 0, hourlyCostUsd: 0 },
      security: {
        runAsNonRoot: true,
        readOnlyRootFilesystem: true,
        dropAllCapabilities: true,
        noNewPrivileges: true,
      },
      provenance: { source: "IRIS", license: "UNLICENSED", version: "0.0.0" },
      healthcheck: { test: ["CMD", "node", "healthcheck.mjs"], intervalSeconds: 30 },
    },
    {
      id: "memory-store",
      name: "Memory Store",
      kind: "database",
      image: { repository: "pgvector/pgvector", digest },
      command: [],
      environment: {},
      ports: [],
      networks: ["iris-private"],
      secrets: ["database-password"],
      resources: { cpuCores: 2, memoryMiB: 4096, storageGiB: 50, gpuCount: 0, hourlyCostUsd: 0 },
      security: {
        runAsNonRoot: true,
        readOnlyRootFilesystem: false,
        dropAllCapabilities: true,
        noNewPrivileges: true,
      },
      provenance: { source: "pgvector", license: "PostgreSQL", version: "0.8.6" },
    },
  ],
  edges: [
    {
      id: "api-memory",
      source: "iris-api",
      target: "memory-store",
      kind: "dependency",
      required: true,
      network: "iris-private",
    },
  ],
};
