import { z } from "zod";

import {
  approvalRecordSchema,
  authorizationDecisionSchema,
  protectedActionTypeSchema,
  sha256DigestSchema,
  timestampSchema,
  type ApprovalRecord,
  type AuthorizationDecision,
} from "@stoic-iris/contracts";

export const approvalEvaluationRequestSchema = z
  .object({
    authenticatedApproverIdentity: z.string().min(1),
    actionType: protectedActionTypeSchema,
    payloadDigest: sha256DigestSchema,
    target: z.string().min(1),
    executor: z.string().min(1),
    tool: z.string().min(1),
    evaluatedAt: timestampSchema,
    previouslyConsumedApprovalIds: z.array(z.string()),
  })
  .strict();
export type ApprovalEvaluationRequest = z.infer<typeof approvalEvaluationRequestSchema>;

export function evaluateApproval(
  candidate: ApprovalRecord,
  request: ApprovalEvaluationRequest,
): AuthorizationDecision {
  const approval = approvalRecordSchema.parse(candidate);
  const expected = approvalEvaluationRequestSchema.parse(request);
  const failures: string[] = [];

  if (approval.state !== "issued") failures.push("Approval is not in the issued state.");
  if (approval.approverIdentity !== expected.authenticatedApproverIdentity)
    failures.push("Authenticated approver identity does not match.");
  if (approval.actionType !== expected.actionType) failures.push("Action type does not match.");
  if (approval.payloadDigest !== expected.payloadDigest)
    failures.push("Payload digest does not match.");
  if (approval.target !== expected.target) failures.push("Target does not match.");
  if (approval.allowedExecutor !== expected.executor) failures.push("Executor does not match.");
  if (!approval.allowedTools.includes(expected.tool)) failures.push("Tool is not authorized.");
  if (
    approval.expiresAt !== undefined &&
    Date.parse(expected.evaluatedAt) >= Date.parse(approval.expiresAt)
  )
    failures.push("Approval is expired.");
  if (expected.previouslyConsumedApprovalIds.includes(approval.approvalId))
    failures.push("Approval was already consumed.");
  if (approval.riskClass === "R4") failures.push("R4 actions cannot be approved.");

  return authorizationDecisionSchema.parse(
    failures.length === 0
      ? {
          decision: "allow",
          riskClass: approval.riskClass,
          reasons: ["Approval matches every bound condition."],
          approvalId: approval.approvalId,
        }
      : { decision: "deny", riskClass: approval.riskClass, reasons: failures },
  );
}

export function consumeApproval(approval: ApprovalRecord, consumedAt: string): ApprovalRecord {
  const current = approvalRecordSchema.parse(approval);
  if (current.state !== "issued") throw new Error("Only an issued approval can be consumed.");
  return approvalRecordSchema.parse({ ...current, state: "consumed", consumedAt });
}
