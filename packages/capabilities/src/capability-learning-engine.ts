import {
  capabilityCandidateSchema,
  capabilityDecisionSchema,
  capabilityReviewSchema,
  digest,
  type CapabilityCandidate,
  type CapabilityDecision,
  type CapabilityReview,
} from "./contracts.js";

export class CapabilityLearningEngine {
  evaluate(candidateInput: CapabilityCandidate, reviewInput: CapabilityReview): CapabilityDecision {
    const candidate = capabilityCandidateSchema.parse(candidateInput);
    const review = capabilityReviewSchema.parse(reviewInput);
    if (candidate.candidateId !== review.candidateId)
      throw new Error("Candidate and review identities do not match.");

    const reviewDigest = digest(review);
    if (!review.provenance.identityVerified || !review.provenance.revisionPinned)
      return capabilityDecisionSchema.parse({
        recommendation: "reject",
        reasons: ["Provenance is not verified and revision-pinned."],
        reviewDigest,
      });
    if (!review.license.reviewed || !review.license.patternUsePermitted)
      return capabilityDecisionSchema.parse({
        recommendation: "reject",
        reasons: ["License review does not permit use of the pattern."],
        reviewDigest,
      });
    if (!review.security.reviewed || review.security.unacceptableRisks.length > 0)
      return capabilityDecisionSchema.parse({
        recommendation: "reject",
        reasons: ["Security review is incomplete or contains unacceptable risks."],
        reviewDigest,
      });
    if (review.mapping.length === 0)
      return capabilityDecisionSchema.parse({
        recommendation: "reject",
        reasons: ["No IRIS capability mapping was supplied."],
        reviewDigest,
      });
    return capabilityDecisionSchema.parse({
      recommendation: review.security.requiresRuntime ? "adopt" : "build",
      reasons: review.security.requiresRuntime
        ? ["A governed adapter is required for the reviewed external runtime."]
        : ["Extracted principles can be implemented as original IRIS-owned software."],
      reviewDigest,
    });
  }
}
