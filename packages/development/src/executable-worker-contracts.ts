import { createHash } from "node:crypto";

import { z } from "zod";

import { sha256Schema } from "./contracts.js";

const executableWorkerBoundaryPathSchema = z
  .string()
  .min(1)
  .max(500)
  .transform((value) => value.replaceAll("\\", "/").replace(/^\.\//u, ""))
  .pipe(
    z
      .string()
      .min(1)
      .max(500)
      .refine((value) => value !== ".." && !value.split("/").includes(".."))
      .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:\//u.test(value)),
  );

export const executableWorkerSafePathSchema = executableWorkerBoundaryPathSchema.pipe(
  z
    .string()
    .refine((value) => value !== ".")
    .refine((value) => value !== ".git" && !value.startsWith(".git/")),
);

export const executableWorkerCommandSchema = z.array(z.string().min(1).max(500)).min(1).max(30);

export const executableWorkerProposalSchema = z
  .object({
    executionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
    objective: z.string().trim().min(10).max(5_000),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
    baseRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    branch: z.string().regex(/^iris\/candidate\/[a-z0-9][a-z0-9/-]{7,180}$/u),
    readPaths: z.array(executableWorkerSafePathSchema).min(1).max(100),
    writePaths: z.array(executableWorkerSafePathSchema).min(1).max(50),
    forbiddenPaths: z.array(executableWorkerBoundaryPathSchema).max(100),
    materializationCommands: z.array(executableWorkerCommandSchema).max(3),
    baselineCommands: z.array(executableWorkerCommandSchema).max(10).optional(),
    normalizationCommands: z.array(executableWorkerCommandSchema).max(5).optional(),
    commands: z.array(executableWorkerCommandSchema).min(1).max(10),
    maximumIterations: z.number().int().min(1).max(5),
    maximumChangedFiles: z.number().int().min(1).max(50),
    maximumChangedBytes: z.number().int().min(1).max(2_000_000),
    timeoutMs: z.number().int().min(30_000).max(900_000),
    expiresAt: z.iso.datetime(),
    budgetUsd: z.literal(0),
    canonicalWrite: z.literal(false),
    externalMutation: z.literal(false),
    mayExpand: z.literal(false),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((proposal, context) => {
    const duplicates = (values: string[]) => new Set(values).size !== values.length;
    if (duplicates(proposal.readPaths))
      context.addIssue({
        code: "custom",
        path: ["readPaths"],
        message: "Read paths must be unique.",
      });
    if (duplicates(proposal.writePaths))
      context.addIssue({
        code: "custom",
        path: ["writePaths"],
        message: "Write paths must be unique.",
      });
    for (const [index, writePath] of proposal.writePaths.entries()) {
      if (
        proposal.forbiddenPaths.some(
          (path) => writePath === path || writePath.startsWith(`${path}/`),
        )
      )
        context.addIssue({
          code: "custom",
          path: ["writePaths", index],
          message: "A write path overlaps a forbidden path.",
        });
    }
  });
export type ExecutableWorkerProposal = z.infer<typeof executableWorkerProposalSchema>;

export const executableWorkerApprovalSchema = z
  .object({
    approvalId: z.string().regex(/^approval_cycle8-[a-z0-9-]{8,100}$/u),
    executionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
    proposalDigest: sha256Schema,
    approvedBy: z.literal("Founder"),
    typedStatement: z.string().min(1).max(10_000),
    issuedAt: z.iso.datetime(),
  })
  .strict();
export type ExecutableWorkerApproval = z.infer<typeof executableWorkerApprovalSchema>;

export const executableWorkerReplacementSchema = z
  .object({
    oldText: z
      .string()
      .min(1)
      .max(1_000_000)
      .refine((value) => !value.includes("\0")),
    newText: z
      .string()
      .max(1_000_000)
      .refine((value) => !value.includes("\0")),
  })
  .strict();
export type ExecutableWorkerReplacement = z.infer<typeof executableWorkerReplacementSchema>;

export const executableWorkerMutationSchema = z
  .object({
    path: executableWorkerSafePathSchema,
    operation: z.enum(["create", "update", "delete"]),
    expectedContentDigest: sha256Schema.optional(),
    content: z
      .string()
      .max(1_000_000)
      .refine((value) => !value.includes("\0"))
      .optional(),
    replacements: z.array(executableWorkerReplacementSchema).min(1).max(100).optional(),
    rationale: z.string().trim().min(1).max(2_000),
  })
  .strict()
  .superRefine((mutation, context) => {
    const issue = (path: string, message: string) => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    if (mutation.operation === "create") {
      if (mutation.content === undefined) issue("content", "Create mutations require content.");
      if (mutation.expectedContentDigest !== undefined)
        issue("expectedContentDigest", "Create mutations cannot bind an existing digest.");
      if (mutation.replacements !== undefined)
        issue("replacements", "Create mutations cannot contain replacements.");
    }
    if (mutation.operation === "update") {
      if (mutation.content !== undefined)
        issue("content", "Update mutations cannot contain complete resulting content.");
      if (mutation.expectedContentDigest === undefined)
        issue("expectedContentDigest", "Update mutations require the current content digest.");
      if (mutation.replacements === undefined)
        issue("replacements", "Update mutations require exact replacements.");
    }
    if (mutation.operation === "delete") {
      if (mutation.content !== undefined)
        issue("content", "Delete mutations cannot contain content.");
      if (mutation.replacements !== undefined)
        issue("replacements", "Delete mutations cannot contain replacements.");
      if (mutation.expectedContentDigest === undefined)
        issue("expectedContentDigest", "Delete mutations require the current content digest.");
    }
  });
export type ExecutableWorkerMutation = z.infer<typeof executableWorkerMutationSchema>;

export const executableWorkerPlanSchema = z
  .object({
    summary: z.string().trim().min(10).max(4_000),
    mutations: z.array(executableWorkerMutationSchema).min(1).max(50),
  })
  .strict();
export type ExecutableWorkerPlan = z.infer<typeof executableWorkerPlanSchema>;

export const executableWorkerCheckSchema = z
  .object({
    command: executableWorkerCommandSchema,
    exitCode: z.number().int(),
    output: z.string().max(64_000),
    outputDigest: sha256Schema,
    outputBytes: z.number().int().nonnegative(),
    outputTruncated: z.boolean(),
    outputRedacted: z.boolean(),
  })
  .strict();
export type ExecutableWorkerCheck = z.infer<typeof executableWorkerCheckSchema>;

export const executableWorkerCleanupAttemptSchema = z
  .object({
    step: z.enum([
      "scope",
      "git-registration",
      "git-remove",
      "git-prune",
      "filesystem-remove",
      "verify",
    ]),
    attempt: z.number().int().positive().max(10),
    ok: z.boolean(),
    code: z.string().min(1).max(200).optional(),
  })
  .strict();

export const executableWorkerCleanupEvidenceSchema = z
  .object({
    workspaceRootVerified: z.boolean(),
    gitRegistrationAbsent: z.boolean(),
    filesystemAbsent: z.boolean(),
    verified: z.boolean(),
    attempts: z.array(executableWorkerCleanupAttemptSchema).max(50),
    completedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      evidence.verified !==
      (evidence.workspaceRootVerified &&
        evidence.gitRegistrationAbsent &&
        evidence.filesystemAbsent)
    )
      context.addIssue({
        code: "custom",
        path: ["verified"],
        message:
          "Cleanup is verified only when scope, Git registration, and filesystem absence pass.",
      });
  });
export type ExecutableWorkerCleanupEvidence = z.infer<typeof executableWorkerCleanupEvidenceSchema>;

export const executableWorkerPreflightSchema = z
  .object({
    ready: z.boolean(),
    checks: z
      .array(
        z
          .object({
            capability: z.string().min(1).max(200),
            status: z.enum(["ready", "blocked"]),
            detail: z.string().min(1).max(2_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export type ExecutableWorkerPreflight = z.infer<typeof executableWorkerPreflightSchema>;

export const executableWorkerStateSchema = z.enum([
  "preflight",
  "preparing-workspace",
  "materializing",
  "planning",
  "editing",
  "verifying",
  "repairing",
  "checkpointing",
  "completed",
  "recovery-ready",
  "stopped",
  "denied",
]);
export type ExecutableWorkerState = z.infer<typeof executableWorkerStateSchema>;

export function executableWorkerProposalDigest(proposal: ExecutableWorkerProposal): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(executableWorkerProposalSchema.parse(proposal)))
    .digest("hex")}`;
}

export function requiredExecutableWorkerApproval(proposal: ExecutableWorkerProposal): string {
  return `I approve ${proposal.executionId} at ${executableWorkerProposalDigest(proposal)} for one disposable local executable-worker run exactly as proposed.`;
}
