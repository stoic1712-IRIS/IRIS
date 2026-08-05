import { z } from "zod";

const identifier = z.string().regex(/^[a-z][a-z0-9-]{1,62}$/);
const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const blueprintProfileSchema = z.enum(["development", "test", "staging", "production"]);
export type BlueprintProfile = z.infer<typeof blueprintProfileSchema>;

export const resourceSpecSchema = z
  .object({
    cpuCores: z.number().positive().max(128),
    memoryMiB: z.number().int().positive().max(1_048_576),
    storageGiB: z.number().nonnegative().max(1_048_576).default(0),
    gpuCount: z.number().int().nonnegative().max(16).default(0),
    hourlyCostUsd: z.number().nonnegative().max(100_000).default(0),
  })
  .strict();

export const blueprintNodeSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(120),
    kind: z.enum([
      "service",
      "database",
      "cache",
      "queue",
      "model",
      "worker",
      "gateway",
      "volume",
      "external",
      "custom",
    ]),
    customType: identifier.optional(),
    image: z
      .object({ repository: z.string().min(1), digest: sha256 })
      .strict()
      .optional(),
    source: z
      .object({ repository: z.url(), revision: z.string().min(7).max(128) })
      .strict()
      .optional(),
    command: z.array(z.string()).max(64).default([]),
    environment: z.record(z.string(), z.string()).default({}),
    ports: z
      .array(
        z
          .object({
            container: z.number().int().min(1).max(65_535),
            host: z.number().int().min(1).max(65_535).optional(),
            protocol: z.enum(["tcp", "udp"]).default("tcp"),
            exposure: z.enum(["private", "host", "public"]).default("private"),
          })
          .strict(),
      )
      .default([]),
    networks: z.array(identifier).default([]),
    secrets: z.array(identifier).default([]),
    resources: resourceSpecSchema,
    security: z
      .object({
        runAsNonRoot: z.boolean(),
        readOnlyRootFilesystem: z.boolean(),
        dropAllCapabilities: z.boolean(),
        noNewPrivileges: z.boolean(),
      })
      .strict(),
    provenance: z
      .object({
        source: z.string().min(1),
        license: z.string().min(1),
        version: z.string().min(1),
      })
      .strict(),
    healthcheck: z
      .object({ test: z.array(z.string()).min(1), intervalSeconds: z.number().int().positive() })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((node, context) => {
    if (node.kind === "custom" && node.customType === undefined)
      context.addIssue({
        code: "custom",
        path: ["customType"],
        message: "Custom nodes require customType.",
      });
    if (node.kind !== "custom" && node.customType !== undefined)
      context.addIssue({
        code: "custom",
        path: ["customType"],
        message: "customType is only valid for custom nodes.",
      });
    if (!["external", "volume"].includes(node.kind) && node.image === undefined)
      context.addIssue({
        code: "custom",
        path: ["image"],
        message: "Executable nodes require an immutable image.",
      });
  });
export type BlueprintNode = z.infer<typeof blueprintNodeSchema>;

export const blueprintEdgeSchema = z
  .object({
    id: identifier,
    source: identifier,
    target: identifier,
    kind: z.enum(["dependency", "network", "data", "secret"]),
    required: z.boolean().default(true),
    network: identifier.optional(),
  })
  .strict();
export type BlueprintEdge = z.infer<typeof blueprintEdgeSchema>;

export const infrastructureBlueprintSchema = z
  .object({
    apiVersion: z.literal("iris.stoic/v1"),
    id: identifier,
    name: z.string().min(1).max(160),
    profile: blueprintProfileSchema,
    approvalStatus: z.enum(["draft", "pending", "approved", "rejected"]),
    nodes: z.array(blueprintNodeSchema).max(2_000),
    edges: z.array(blueprintEdgeSchema).max(8_000),
    networks: z.array(z.object({ id: identifier, internal: z.boolean() }).strict()).max(128),
    secrets: z
      .array(
        z.object({ id: identifier, provider: z.enum(["environment", "file", "vault"]) }).strict(),
      )
      .max(256),
    policy: z
      .object({
        allowPublicExposure: z.boolean(),
        requireDigestLocks: z.boolean(),
        requireNonRoot: z.boolean(),
        maxHourlyCostUsd: z.number().nonnegative(),
      })
      .strict(),
    metadata: z
      .object({
        createdBy: z.string().min(1),
        createdAt: z.iso.datetime({ offset: true }),
        sourceRevision: z.string().min(7),
      })
      .strict(),
  })
  .strict();
export type InfrastructureBlueprint = z.infer<typeof infrastructureBlueprintSchema>;

export const validationFindingSchema = z
  .object({
    severity: z.enum(["error", "warning"]),
    code: z.enum([
      "duplicate-id",
      "missing-endpoint",
      "missing-network",
      "missing-secret",
      "port-collision",
      "public-exposure",
      "dependency-cycle",
      "capacity-exceeded",
      "cost-exceeded",
      "missing-lock",
      "security-policy",
    ]),
    path: z.string(),
    message: z.string(),
  })
  .strict();
export type ValidationFinding = z.infer<typeof validationFindingSchema>;
