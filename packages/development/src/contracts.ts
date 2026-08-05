import { createHash } from "node:crypto";

import { z } from "zod";

export const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const safePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(value))
  .refine((value) => !value.replaceAll("\\", "/").split("/").includes(".."));

export const fileMutationSchema = z
  .object({
    path: safePathSchema,
    operation: z.enum(["create", "update", "delete"]),
    beforeDigest: sha256Schema.nullable(),
    afterDigest: sha256Schema.nullable(),
    content: z.string().max(1_000_000).optional(),
    rationale: z.string().min(1).max(2_000),
  })
  .strict()
  .superRefine((change, context) => {
    if (change.operation === "create" && change.beforeDigest !== null)
      context.addIssue({
        code: "custom",
        path: ["beforeDigest"],
        message: "Create requires no prior digest.",
      });
    if (
      change.operation === "delete" &&
      (change.afterDigest !== null || change.content !== undefined)
    )
      context.addIssue({
        code: "custom",
        path: ["afterDigest"],
        message: "Delete requires no resulting content.",
      });
    if (
      change.operation !== "delete" &&
      (change.afterDigest === null || change.content === undefined)
    )
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: "Create and update require exact resulting content.",
      });
  });

export const developmentProposalSchema = z
  .object({
    proposalId: z.string().regex(/^proposal_[a-z0-9][a-z0-9-]{2,99}$/),
    objective: z.string().min(1).max(5_000),
    canonicalRepository: z.string().min(1),
    baseRevision: z.string().regex(/^[a-f0-9]{40}$/),
    branch: z.string().regex(/^iris\/[a-z0-9][a-z0-9/-]{2,199}$/),
    allowedPaths: z.array(safePathSchema).min(1),
    forbiddenPaths: z.array(safePathSchema),
    changes: z.array(fileMutationSchema).min(2),
    commands: z.array(z.array(z.string().min(1)).min(1)).min(1),
    requiredChecks: z.array(z.string().min(1)).min(1),
    checkpointRemote: z.string().min(1),
    rollback: z
      .object({ strategy: z.literal("revert"), preserveHistory: z.literal(true) })
      .strict(),
    cleanup: z
      .object({
        deleteWorkspace: z.literal(true),
        terminatePaidResources: z.literal(true),
        verifyProviderZero: z.literal(true),
      })
      .strict(),
    model: z.object({ provider: z.string().min(1), name: z.string().min(1) }).strict(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((proposal, context) => {
    const allowed = (path: string) =>
      proposal.allowedPaths.some(
        (root) => path === root || path.startsWith(`${root.replace(/\/$/, "")}/`),
      );
    for (const [index, change] of proposal.changes.entries()) {
      if (!allowed(change.path))
        context.addIssue({
          code: "custom",
          path: ["changes", index, "path"],
          message: "Change is outside allowed paths.",
        });
      if (
        proposal.forbiddenPaths.some(
          (root) => change.path === root || change.path.startsWith(`${root.replace(/\/$/, "")}/`),
        )
      )
        context.addIssue({
          code: "custom",
          path: ["changes", index, "path"],
          message: "Change targets a forbidden path.",
        });
      if (
        change.afterDigest !== null &&
        change.content !== undefined &&
        digestText(change.content) !== change.afterDigest
      )
        context.addIssue({
          code: "custom",
          path: ["changes", index, "afterDigest"],
          message: "Result digest does not match exact content.",
        });
    }
  });
export type DevelopmentProposal = z.infer<typeof developmentProposalSchema>;

export const developmentApprovalSchema = z
  .object({
    approvalId: z.string().regex(/^approval_[a-z0-9][a-z0-9-]{2,99}$/),
    proposalId: z.string(),
    proposalDigest: sha256Schema,
    authenticatedFounder: z.string().min(1),
    typedStatement: z.string().min(1),
    issuedAt: z.iso.datetime({ offset: true }),
    state: z.literal("issued"),
  })
  .strict();
export type DevelopmentApproval = z.infer<typeof developmentApprovalSchema>;

export function digestText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
export function proposalDigest(proposal: DevelopmentProposal): string {
  return digestText(JSON.stringify(developmentProposalSchema.parse(proposal)));
}
export function requiredApprovalStatement(proposal: DevelopmentProposal): string {
  return `I approve ${proposal.proposalId} at ${proposalDigest(proposal)} for IRIS execution exactly as proposed.`;
}
