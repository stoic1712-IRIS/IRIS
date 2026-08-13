import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalIdSchema,
  riskClassSchema,
  sha256DigestSchema,
  timestampSchema,
} from "@stoic-iris/contracts";

import { CognitiveTurnError } from "./cognitive-turn-errors.js";
import {
  irisModelNameSchema,
  modelRoutePurposeSchema,
  modelRouteSchema,
  type ModelRoute,
} from "./model-router.js";

export const primaryIrisOrchestratorModel = "qwen3.6:27b" as const;
export const degradedIrisDialogueModel = "qwen3:8b" as const;

export const cognitiveTurnModeSchema = z.enum(["direct", "delegated"]);
export type CognitiveTurnMode = z.infer<typeof cognitiveTurnModeSchema>;

export const cognitiveTurnPhaseSchema = z.enum([
  "accepted",
  "orchestrator-planning",
  "delegation-validated",
  "specialist-loading",
  "specialist-working",
  "verification-running",
  "independent-review",
  "orchestrator-synthesizing",
  "completed",
  "paused",
  "cancelled",
  "recovery-required",
  "reviewer-model-unavailable",
  "synthesis-failed",
  "degraded-interface",
]);
export type CognitiveTurnPhase = z.infer<typeof cognitiveTurnPhaseSchema>;

export const exactEvidenceReferenceSchema = z
  .object({
    evidenceId: canonicalIdSchema.refine((value) => value.startsWith("evidence_")),
    kind: z.enum([
      "artifact",
      "citation",
      "command-result",
      "approval",
      "digest",
      "review",
      "rollback",
    ]),
    label: z.string().min(1).max(300),
    exactValue: z.string().min(1).max(20_000),
    contentDigest: sha256DigestSchema,
    requiredInPresentation: z.boolean(),
  })
  .strict();
export type ExactEvidenceReference = z.infer<typeof exactEvidenceReferenceSchema>;

function sha256(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

export function exactEvidenceContentDigest(exactValue: string): `sha256:${string}` {
  return sha256(exactValue);
}

export const cognitiveTurnRequestSchema = z
  .object({
    requestId: canonicalIdSchema.refine((value) => value.startsWith("request_")),
    correlationId: canonicalIdSchema,
    sessionId: z.string().regex(/^founder_session_[0-9a-f-]{36}$/u),
    objectiveId: canonicalIdSchema.refine((value) => value.startsWith("objective_")),
    objectiveDigest: sha256DigestSchema,
    utterance: z.string().trim().min(1).max(6_000),
    riskClass: riskClassSchema,
    repositoryScope: z.array(z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)).max(8),
    pathScope: z.array(z.string().min(1).max(500)).max(100),
    availableModels: z.array(irisModelNameSchema).min(1).max(4),
    hasImage: z.boolean().default(false),
    // The capabilities the operating controller already resolved for this turn. Routing must
    // honour them: without this field the orchestrator re-routed every turn by keyword alone, so
    // a read-only repository inspection dense with git vocabulary was handed to the coding
    // specialist, which voided four consecutive Certification Test One attempts by fabricating a
    // permissions refusal over evidence it was holding.
    requiredCapabilities: z.array(z.string().min(1).max(200)).max(25).default([]),
    occurredAt: timestampSchema,
  })
  .strict();
export type CognitiveTurnRequest = z.infer<typeof cognitiveTurnRequestSchema>;

export const cognitiveDelegationPolicySchema = z
  .object({
    allowedCapabilities: z.array(z.string().min(1).max(200)).max(100),
    protectedEffectStop: z.boolean(),
    requiredReviewPurposes: z.array(modelRoutePurposeSchema).max(6),
  })
  .strict();
export type CognitiveDelegationPolicy = z.infer<typeof cognitiveDelegationPolicySchema>;

export const cognitiveDelegationEnvelopeSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("direct"),
      objectiveId: canonicalIdSchema,
      objectiveDigest: sha256DigestSchema,
      narrative: z.string().trim().min(1).max(6_000),
      requestedCapabilities: z.tuple([]),
      specialistPurpose: z.null(),
      authority: z.literal("none"),
    })
    .strict(),
  z
    .object({
      mode: z.literal("delegated"),
      objectiveId: canonicalIdSchema,
      objectiveDigest: sha256DigestSchema,
      requestedCapabilities: z.array(z.string().min(1).max(200)).min(1).max(16),
      specialistPurpose: modelRoutePurposeSchema,
      rationale: z.string().trim().min(1).max(1_000),
      authority: z.literal("none"),
    })
    .strict(),
]);
export type CognitiveDelegationEnvelope = z.infer<typeof cognitiveDelegationEnvelopeSchema>;

export const cognitiveSpecialistInputSchema = z
  .object({
    requestId: canonicalIdSchema,
    objectiveId: canonicalIdSchema,
    objectiveDigest: sha256DigestSchema,
    repositoryScope: z.array(z.string().min(1).max(300)).max(8),
    pathScope: z.array(z.string().min(1).max(500)).max(100),
    capabilities: z.array(z.string().min(1).max(200)).min(1).max(16),
    route: modelRouteSchema,
    steeringNotes: z.array(z.string().min(1).max(1_000)).max(10),
    authority: z.literal("none"),
  })
  .strict();
export type CognitiveSpecialistInput = z.infer<typeof cognitiveSpecialistInputSchema>;

export const cognitiveSpecialistArtifactSchema = z
  .object({
    requestId: canonicalIdSchema,
    objectiveId: canonicalIdSchema,
    objectiveDigest: sha256DigestSchema,
    route: modelRouteSchema,
    status: z.enum(["passed", "failed", "blocked"]),
    summary: z.string().trim().min(1).max(6_000),
    evidence: z.array(exactEvidenceReferenceSchema).max(100),
    artifactDigest: sha256DigestSchema,
    occurredAt: timestampSchema,
    authority: z.literal("none"),
  })
  .strict();
export type CognitiveSpecialistArtifact = z.infer<typeof cognitiveSpecialistArtifactSchema>;

export function specialistArtifactContentDigest(
  artifact: Omit<CognitiveSpecialistArtifact, "artifactDigest">,
): `sha256:${string}` {
  return sha256(
    JSON.stringify({
      requestId: artifact.requestId,
      objectiveId: artifact.objectiveId,
      objectiveDigest: artifact.objectiveDigest,
      route: artifact.route,
      status: artifact.status,
      summary: artifact.summary,
      evidence: artifact.evidence,
      occurredAt: artifact.occurredAt,
      authority: artifact.authority,
    }),
  );
}

export const cognitiveReviewInputSchema = z
  .object({
    requestId: canonicalIdSchema,
    objectiveId: canonicalIdSchema,
    objectiveDigest: sha256DigestSchema,
    specialistArtifact: cognitiveSpecialistArtifactSchema,
    specialistArtifactDigest: sha256DigestSchema,
    reviewerModel: irisModelNameSchema,
    acceptanceCriteria: z.array(z.string().trim().min(1).max(1_000)).min(1).max(50),
    authority: z.literal("none"),
  })
  .strict();
export type CognitiveReviewInput = z.infer<typeof cognitiveReviewInputSchema>;

export const cognitiveReviewArtifactSchema = z
  .object({
    requestId: canonicalIdSchema,
    objectiveId: canonicalIdSchema,
    objectiveDigest: sha256DigestSchema,
    specialistArtifactDigest: sha256DigestSchema,
    reviewerModel: irisModelNameSchema,
    verdict: z.enum(["pass", "revise", "block"]),
    findings: z.array(z.string().trim().min(1).max(2_000)).max(100),
    evidence: z.array(exactEvidenceReferenceSchema).max(100),
    occurredAt: timestampSchema,
    authority: z.literal("none"),
  })
  .strict();
export type CognitiveReviewArtifact = z.infer<typeof cognitiveReviewArtifactSchema>;

const synthesisEvidenceDescriptorSchema = z
  .object({
    evidenceId: canonicalIdSchema,
    label: z.string().min(1).max(300),
    contentDigest: sha256DigestSchema,
  })
  .strict();

export const cognitiveSynthesisInputSchema = z
  .object({
    requestId: canonicalIdSchema,
    objectiveId: canonicalIdSchema,
    objectiveDigest: sha256DigestSchema,
    route: modelRouteSchema.nullable(),
    specialistArtifact: cognitiveSpecialistArtifactSchema.nullable(),
    reviewArtifact: cognitiveReviewArtifactSchema.nullable(),
    evidence: z.array(synthesisEvidenceDescriptorSchema).max(200),
    completionEligible: z.boolean(),
    steeringNotes: z.array(z.string().min(1).max(1_000)).max(10),
    repairFailureCode: z.string().min(1).max(120).nullable(),
    authority: z.literal("none"),
  })
  .strict();
export type CognitiveSynthesisInput = z.infer<typeof cognitiveSynthesisInputSchema>;

export const cognitiveSynthesisSchema = z
  .object({
    narrative: z.string().trim().min(1).max(6_000),
    acknowledgedEvidenceIds: z.array(canonicalIdSchema).max(200),
    authority: z.literal("none"),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.acknowledgedEvidenceIds).size !== value.acknowledgedEvidenceIds.length) {
      context.addIssue({
        code: "custom",
        path: ["acknowledgedEvidenceIds"],
        message: "Evidence acknowledgements must be unique.",
      });
    }
  });
export type CognitiveSynthesis = z.infer<typeof cognitiveSynthesisSchema>;

export const cognitiveFounderPresentationSchema = z
  .object({
    requestId: canonicalIdSchema,
    objectiveId: canonicalIdSchema,
    narrative: z.string().trim().min(1).max(6_000),
    completion: z.enum(["completed", "blocked", "failed"]),
    exactEvidence: z.array(exactEvidenceReferenceSchema).max(200),
    provenance: z
      .object({
        orchestratorModel: irisModelNameSchema,
        specialistModel: irisModelNameSchema.nullable(),
        reviewerModel: irisModelNameSchema.nullable(),
      })
      .strict(),
    degraded: z.boolean(),
    authority: z.literal("none"),
  })
  .strict();
export type CognitiveFounderPresentation = z.infer<typeof cognitiveFounderPresentationSchema>;

export const cognitiveTransitionEventSchema = z
  .object({
    eventId: canonicalIdSchema,
    requestId: canonicalIdSchema,
    correlationId: canonicalIdSchema,
    sequence: z.number().int().positive(),
    previousEventDigest: sha256DigestSchema.nullable(),
    phase: cognitiveTurnPhaseSchema,
    model: irisModelNameSchema.nullable(),
    reason: z.string().trim().min(1).max(500),
    occurredAt: timestampSchema,
    eventDigest: sha256DigestSchema,
  })
  .strict();
export type CognitiveTransitionEvent = z.infer<typeof cognitiveTransitionEventSchema>;

export const modelLeaseEventSchema = z
  .object({
    requestId: canonicalIdSchema,
    leaseId: z.string().min(1).max(300),
    model: irisModelNameSchema,
    phase: cognitiveTurnPhaseSchema,
    type: z.enum(["acquired", "release-requested", "released", "release-failed", "cancelled"]),
    reason: z.string().min(1).max(300).nullable(),
    occurredAt: timestampSchema,
  })
  .strict();
export type ModelLeaseEvent = z.infer<typeof modelLeaseEventSchema>;

export const cognitiveTurnSnapshotSchema = z
  .object({
    request: cognitiveTurnRequestSchema,
    policy: cognitiveDelegationPolicySchema,
    phase: cognitiveTurnPhaseSchema,
    generation: z.number().int().nonnegative(),
    route: modelRouteSchema.nullable(),
    delegation: cognitiveDelegationEnvelopeSchema.nullable(),
    specialistArtifact: cognitiveSpecialistArtifactSchema.nullable(),
    reviewArtifact: cognitiveReviewArtifactSchema.nullable(),
    synthesisAttempts: z.number().int().nonnegative().max(2),
    steeringNotes: z.array(z.string().min(1).max(1_000)).max(10),
    transitionEvents: z.array(cognitiveTransitionEventSchema).max(1_000),
    leaseEvents: z.array(modelLeaseEventSchema).max(1_000),
    presentation: cognitiveFounderPresentationSchema.nullable(),
    safeFailureCode: z.string().min(1).max(120).nullable(),
    updatedAt: timestampSchema,
  })
  .strict();
export type CognitiveTurnSnapshot = z.infer<typeof cognitiveTurnSnapshotSchema>;

export interface ValidatedCognitiveDelegation {
  readonly envelope: CognitiveDelegationEnvelope;
  readonly route: ModelRoute;
  readonly requiresIndependentReview: boolean;
}

function fail(code: ConstructorParameters<typeof CognitiveTurnError>[0]): never {
  throw new CognitiveTurnError(code);
}

export function validateCognitiveDelegation(
  envelopeInput: unknown,
  requestInput: unknown,
  routeInput: unknown,
  policyInput: unknown,
): ValidatedCognitiveDelegation {
  const envelope = cognitiveDelegationEnvelopeSchema.parse(envelopeInput);
  const request = cognitiveTurnRequestSchema.parse(requestInput);
  const route = modelRouteSchema.parse(routeInput);
  const policy = cognitiveDelegationPolicySchema.parse(policyInput);

  if (
    envelope.objectiveId !== request.objectiveId ||
    envelope.objectiveDigest !== request.objectiveDigest
  ) {
    fail("COGNITIVE_OBJECTIVE_BINDING_MISMATCH");
  }
  if (policy.protectedEffectStop) fail("COGNITIVE_PROTECTED_EFFECT_STOP");

  if (envelope.mode === "direct") {
    if (
      route.purpose !== "conversation" &&
      route.purpose !== "vision" &&
      route.purpose !== "fast-response"
    ) {
      fail("COGNITIVE_ROUTE_MISMATCH");
    }
  } else {
    const capabilities = envelope.requestedCapabilities;
    if (
      new Set(capabilities).size !== capabilities.length ||
      capabilities.some((capability) => !policy.allowedCapabilities.includes(capability))
    ) {
      fail("COGNITIVE_CAPABILITY_NOT_ALLOWED");
    }
    if (envelope.specialistPurpose !== route.purpose) fail("COGNITIVE_ROUTE_MISMATCH");
  }

  return Object.freeze({
    envelope,
    route,
    requiresIndependentReview:
      envelope.mode === "delegated" && policy.requiredReviewPurposes.includes(route.purpose),
  });
}

export function requiredPresentationEvidence(
  specialistArtifact: CognitiveSpecialistArtifact | null,
  reviewArtifact: CognitiveReviewArtifact | null,
): ExactEvidenceReference[] {
  const allEvidence = [
    ...(specialistArtifact?.evidence ?? []),
    ...(reviewArtifact?.evidence ?? []),
  ];
  const byId = new Map<string, ExactEvidenceReference>();
  for (const evidence of allEvidence) {
    if (evidence.contentDigest !== exactEvidenceContentDigest(evidence.exactValue)) {
      fail("COGNITIVE_EVIDENCE_MISMATCH");
    }
    const previous = byId.get(evidence.evidenceId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(evidence)) {
      fail("COGNITIVE_EVIDENCE_MISMATCH");
    }
    byId.set(evidence.evidenceId, evidence);
  }
  return [...byId.values()].filter((evidence) => evidence.requiredInPresentation);
}
