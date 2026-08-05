import { z } from "zod";

import {
  canonicalIdSchema,
  riskClassSchema,
  sha256DigestSchema,
  timestampSchema,
} from "./primitives.js";

export const protectedActionTypes = [
  "stage",
  "commit",
  "push",
  "create-pull-request",
  "merge",
  "deploy",
  "public-release",
  "repository-visibility-change",
  "branch-protection-change",
  "secret-use",
  "financial-commitment",
  "paid-resource-creation",
  "destructive-action",
  "canonical-governance-adoption",
  "identity-amendment",
] as const;

export const protectedActionTypeSchema = z.enum(protectedActionTypes);
export type ProtectedActionType = z.infer<typeof protectedActionTypeSchema>;

export const approvalStateSchema = z.enum(["issued", "consumed", "rejected", "expired", "revoked"]);

export const approvalRecordSchema = z
  .object({
    approvalId: canonicalIdSchema,
    approverIdentity: z.string().min(1).max(500),
    requestId: canonicalIdSchema,
    proposalId: canonicalIdSchema,
    riskClass: riskClassSchema,
    actionType: protectedActionTypeSchema,
    payloadDigest: sha256DigestSchema,
    target: z.string().min(1).max(2048),
    allowedExecutor: z.string().min(1).max(500),
    allowedTools: z.array(z.string().min(1).max(200)).min(1),
    preconditions: z.array(z.string().min(1).max(1000)),
    exclusions: z.array(z.string().min(1).max(1000)),
    issuedAt: timestampSchema,
    expiresAt: timestampSchema.optional(),
    oneTimeUse: z.boolean(),
    requiredVerification: z.array(z.string().min(1).max(1000)).min(1),
    requiredCleanup: z.array(z.string().min(1).max(1000)),
    state: approvalStateSchema,
    consumedAt: timestampSchema.optional(),
  })
  .strict()
  .superRefine((approval, context) => {
    if (approval.state === "consumed" && approval.consumedAt === undefined) {
      context.addIssue({
        code: "custom",
        message: "A consumed approval requires consumedAt.",
        path: ["consumedAt"],
      });
    }
    if (approval.state !== "consumed" && approval.consumedAt !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Only a consumed approval may contain consumedAt.",
        path: ["consumedAt"],
      });
    }
    if (
      approval.expiresAt !== undefined &&
      Date.parse(approval.expiresAt) <= Date.parse(approval.issuedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "expiresAt must be later than issuedAt.",
        path: ["expiresAt"],
      });
    }
    if (
      approval.consumedAt !== undefined &&
      Date.parse(approval.consumedAt) < Date.parse(approval.issuedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "consumedAt cannot precede issuedAt.",
        path: ["consumedAt"],
      });
    }
  });
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;

export const authorizationDecisionSchema = z
  .object({
    decision: z.enum(["allow", "deny", "require-approval"]),
    riskClass: riskClassSchema,
    reasons: z.array(z.string().min(1).max(1000)).min(1),
    approvalId: canonicalIdSchema.optional(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.decision === "allow" && decision.riskClass === "R4") {
      context.addIssue({
        code: "custom",
        message: "R4 actions cannot be allowed.",
        path: ["decision"],
      });
    }
    if (decision.approvalId !== undefined && decision.decision !== "allow") {
      context.addIssue({
        code: "custom",
        message: "Only an allow decision may consume an approval.",
        path: ["approvalId"],
      });
    }
  });
export type AuthorizationDecision = z.infer<typeof authorizationDecisionSchema>;
