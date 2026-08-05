import { createHash } from "node:crypto";

import { timestampSchema } from "@stoic-iris/contracts";
import { z } from "zod";

const safePathSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(value))
  .refine((value) => !value.replaceAll("\\", "/").split("/").includes(".."));

export const workerSpecificationSchema = z
  .object({
    workerId: z.string().regex(/^worker_[a-z0-9][a-z0-9-]{2,99}$/),
    workerClass: z.enum(["read-only", "coding"]),
    identity: z
      .object({
        name: z.string().min(1).max(200),
        role: z.string().min(1).max(500),
        authority: z.literal("none"),
      })
      .strict(),
    mission: z
      .object({
        objective: z.string().min(1).max(5_000),
        taskId: z.string().min(1).max(200),
        prohibitedObjectives: z.array(z.string().min(1).max(500)),
      })
      .strict(),
    reasoning: z
      .object({
        instructions: z.array(z.string().min(1).max(1_000)).min(1),
        mustCiteEvidence: z.boolean(),
        maySelfApprove: z.literal(false),
        mayDelegate: z.literal(false),
      })
      .strict(),
    permissions: z
      .object({
        tools: z.array(z.string().min(1).max(100)),
        readPaths: z.array(safePathSchema),
        writePaths: z.array(safePathSchema),
        mayExpand: z.literal(false),
      })
      .strict(),
    memory: z
      .object({
        categories: z.array(
          z.enum([
            "founder",
            "project",
            "operational",
            "knowledge",
            "capability",
            "model",
            "audit",
          ]),
        ),
        maximumSensitivity: z.enum([
          "public",
          "internal",
          "sensitive",
          "secret",
          "recovery-authority",
        ]),
        maximumItems: z.number().int().min(0).max(1_000),
      })
      .strict(),
    tools: z
      .object({ commandAllowlist: z.array(z.string().min(1).max(200)), shell: z.boolean() })
      .strict(),
    network: z.object({ mode: z.literal("none"), allowedHosts: z.tuple([]) }).strict(),
    resources: z
      .object({
        timeoutMs: z.number().int().min(10).max(300_000),
        memoryMiB: z.number().int().min(64).max(32_768),
        cpuCount: z.number().positive().max(32),
        gpuVramMiB: z.number().int().min(0).max(24_576),
        processLimit: z.number().int().min(1).max(1_024),
      })
      .strict(),
    success: z
      .object({
        requiredOutputFields: z.array(z.string().min(1).max(200)).min(1),
        independentVerification: z.literal(true),
      })
      .strict(),
    cleanup: z
      .object({
        terminateWorker: z.literal(true),
        deleteWorkspace: z.literal(true),
        verifyZeroResources: z.literal(true),
      })
      .strict(),
    model: z
      .object({
        provider: z.string().min(1).max(100),
        model: z.string().min(1).max(200),
        purpose: z.string().min(1).max(500),
      })
      .strict(),
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((specification, context) => {
    if (
      specification.workerClass === "read-only" &&
      specification.permissions.writePaths.length > 0
    )
      context.addIssue({
        code: "custom",
        path: ["permissions", "writePaths"],
        message: "Read-only workers cannot receive write paths.",
      });
  });
export type WorkerSpecification = z.infer<typeof workerSpecificationSchema>;

export function workerSpecificationDigest(specification: WorkerSpecification): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(workerSpecificationSchema.parse(specification)))
    .digest("hex")}`;
}

export interface WorkerContext {
  objective: string;
  repositoryFiles: { path: string; citation: string }[];
  memories: {
    category: WorkerSpecification["memory"]["categories"][number];
    sensitivity: WorkerSpecification["memory"]["maximumSensitivity"];
    value: string;
    citation: string;
  }[];
  constraints: string[];
}
