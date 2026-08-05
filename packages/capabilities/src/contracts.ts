import { createHash } from "node:crypto";

import { z } from "zod";

const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]{2,99}$/);

export const capabilityCandidateSchema = z
  .object({
    candidateId: identifier,
    name: z.string().min(1).max(200),
    sourceIdentity: z.url(),
    sourceRevision: z.string().min(7).max(200),
    sourceLicense: z.string().min(1).max(100),
    reviewedAt: z.iso.datetime({ offset: true }),
    proposedPatterns: z.array(z.string().min(1).max(500)).min(1),
    copiedSourceCode: z.literal(false),
  })
  .strict();
export type CapabilityCandidate = z.infer<typeof capabilityCandidateSchema>;

export const capabilityReviewSchema = z
  .object({
    candidateId: identifier,
    provenance: z.object({ identityVerified: z.boolean(), revisionPinned: z.boolean() }).strict(),
    license: z
      .object({
        reviewed: z.boolean(),
        patternUsePermitted: z.boolean(),
        obligations: z.array(z.string()),
      })
      .strict(),
    security: z
      .object({
        reviewed: z.boolean(),
        unacceptableRisks: z.array(z.string()),
        requiresRuntime: z.boolean(),
      })
      .strict(),
    mapping: z.array(
      z
        .object({
          pattern: z.string().min(1),
          irisCapability: z.string().min(1),
          boundary: z.string().min(1),
        })
        .strict(),
    ),
    extractedPrinciples: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type CapabilityReview = z.infer<typeof capabilityReviewSchema>;

export const founderPatternApprovalSchema = z
  .object({
    approvalId: identifier,
    candidateId: identifier,
    reviewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    decision: z.literal("approved"),
    actor: z.literal("Founder"),
    approvedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type FounderPatternApproval = z.infer<typeof founderPatternApprovalSchema>;

export const capabilityDecisionSchema = z
  .object({
    recommendation: z.enum(["build", "adopt", "reject"]),
    reasons: z.array(z.string().min(1)).min(1),
    reviewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();
export type CapabilityDecision = z.infer<typeof capabilityDecisionSchema>;

export function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
