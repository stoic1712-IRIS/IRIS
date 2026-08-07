import { z } from "zod";

import {
  phaseZeroApprovalConsumptionReceiptSchema,
  phaseZeroCanonicalEqualitySchema,
  phaseZeroCleanupEvidenceSchema,
  phaseZeroDeliverySchema,
  phaseZeroGraduationApprovalSchema,
  phaseZeroGraduationStages,
  phaseZeroIndependentReviewSchema,
  phaseZeroMergeApprovalSchema,
  phaseZeroMergeSchema,
  phaseZeroProviderInspectionSchema,
  phaseZeroResourceTerminationSchema,
  phaseZeroRollbackEvidenceSchema,
  verifyPhaseZeroGraduationEventChain,
} from "./phase-zero-graduation-readiness.js";

export const phaseZeroGraduationTransportVersion = "iris.stoic/phase-zero-graduation/v1" as const;
export const phaseZeroGraduationTransportPaths = {
  readiness: "/v1/graduation-readiness",
  approvals: "/v1/graduation-approvals",
} as const;

const revision = z.string().regex(/^[a-f0-9]{40}$/u);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const safeIdentifier = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/u);
const graduationId = z.string().regex(/^graduation_phase0-[a-z0-9-]{8,100}$/u);
const stage = z.enum(phaseZeroGraduationStages);

export const phaseZeroGraduationProposalViewSchema = z.strictObject({
  graduationId,
  actor: z.literal("IRIS"),
  producerId: z.literal("iris-development-worker"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  canonicalBaseRevision: revision,
  commandCenterRepository: z.literal("stoic1712-IRIS/iris-founder-command-center"),
  commandCenterBaseRevision: revision,
  deploymentId: safeIdentifier,
  deployedRuntime: z.literal(true),
  modelProvider: z.enum(["ollama", "lm-studio"]),
  modelName: z.string().trim().min(2).max(200),
  modelEndpoint: z.literal("loopback"),
  realModel: z.literal(true),
  candidateBranch: z.string().regex(/^iris\/candidate\/[a-z0-9][a-z0-9/-]{7,180}$/u),
  checkpointRepository: z.literal("stoic1712-IRIS/IRIS-checkpoints"),
  checkpointRef: z.string().regex(/^checkpoint\/phase-zero-[a-f0-9]{12}$/u),
  targetBranch: z.string().regex(/^iris\/phase-zero-graduation-[a-f0-9]{12}$/u),
  verificationCommands: z
    .array(z.array(z.string().min(1).max(500)).min(1).max(30))
    .min(1)
    .max(10),
  checkpointFirst: z.literal(true),
  independentReviewRequired: z.literal(true),
  mergeRequired: z.literal(true),
  historyPreservingRollback: z.literal(true),
  codexMutation: z.literal(false),
  claudeMutation: z.literal(false),
  fixtureExecution: z.literal(false),
  maximumCostUsd: z.literal(0),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

export const phaseZeroGraduationEventSchema = z.strictObject({
  sequence: z.number().int().positive(),
  stage,
  summary: z.string().min(1).max(2_000),
  evidence: z.unknown(),
  evidenceDigest: digest,
  previousDigest: digest.nullable(),
  digest,
});

export function verifyPhaseZeroGraduationStageProgression(
  events: readonly { stage: (typeof phaseZeroGraduationStages)[number] }[],
  completed = false,
): boolean {
  if (events.length === 0 || events[0]?.stage !== "approval") return false;
  const indexes = events.map((event) => phaseZeroGraduationStages.indexOf(event.stage));
  if (indexes.some((value, index) => index > 0 && value <= (indexes[index - 1] ?? value)))
    return false;
  return (
    !completed ||
    (events.length === phaseZeroGraduationStages.length &&
      events.every((event, index) => event.stage === phaseZeroGraduationStages[index]))
  );
}

export const phaseZeroGraduationResultTransportSchema = z
  .strictObject({
    graduationId,
    status: z.enum(["succeeded", "denied", "failed"]),
    stage,
    failureStage: stage.optional(),
    summary: z.string().min(1).max(4_000),
    approvalConsumed: z.union([z.boolean(), z.literal("unknown")]),
    mergeApprovalConsumed: z.union([z.boolean(), z.literal("unknown")]),
    canonicalRepositoryChanged: z.boolean().nullable(),
    canonicalRepositoryChangeVerified: z.boolean(),
    phase0GraduationEvidenceComplete: z.boolean(),
    providerZeroVerified: z.boolean(),
    events: z.array(phaseZeroGraduationEventSchema).min(1).max(128),
    review: phaseZeroIndependentReviewSchema.optional(),
    delivery: phaseZeroDeliverySchema.optional(),
    merge: phaseZeroMergeSchema.optional(),
    equality: phaseZeroCanonicalEqualitySchema.optional(),
    rollback: phaseZeroRollbackEvidenceSchema.optional(),
    cleanup: phaseZeroCleanupEvidenceSchema.optional(),
    graduationApprovalReceipt: phaseZeroApprovalConsumptionReceiptSchema.optional(),
    mergeApprovalReceipt: phaseZeroApprovalConsumptionReceiptSchema.optional(),
    resourceTermination: phaseZeroResourceTerminationSchema.optional(),
    providerInspection: phaseZeroProviderInspectionSchema.optional(),
  })
  .superRefine((result, context) => {
    const completed = result.status === "succeeded" && result.stage === "completed";
    if (!verifyPhaseZeroGraduationEventChain(result.events))
      context.addIssue({
        code: "custom",
        path: ["events"],
        message: "Graduation event hashes or links are invalid.",
      });
    if (result.status === "succeeded" && result.stage !== "completed")
      context.addIssue({
        code: "custom",
        path: ["stage"],
        message: "A successful graduation result must reach the completed stage.",
      });
    if (
      result.status === "succeeded" &&
      (result.approvalConsumed !== true ||
        result.mergeApprovalConsumed !== true ||
        result.canonicalRepositoryChanged !== true ||
        !result.canonicalRepositoryChangeVerified ||
        !result.phase0GraduationEvidenceComplete ||
        !result.providerZeroVerified ||
        result.review === undefined ||
        result.delivery === undefined ||
        result.merge === undefined ||
        result.equality === undefined ||
        result.rollback === undefined ||
        result.cleanup === undefined ||
        result.graduationApprovalReceipt === undefined ||
        result.mergeApprovalReceipt === undefined ||
        result.resourceTermination === undefined ||
        result.providerInspection === undefined ||
        result.providerInspection.resources.length > 0)
    )
      context.addIssue({
        code: "custom",
        message: "A successful graduation result requires the complete verified evidence chain.",
      });
    if (!verifyPhaseZeroGraduationStageProgression(result.events, completed))
      context.addIssue({
        code: "custom",
        path: ["events"],
        message: "Graduation events do not follow the canonical Core stage progression.",
      });
  });

export const phaseZeroMergeApprovalContextSchema = z.strictObject({
  deliveryCommit: revision,
  reviewedCommit: revision,
  pullRequestNumber: z.number().int().positive(),
});

const envelopeBase = {
  apiVersion: z.literal(phaseZeroGraduationTransportVersion),
  coreRevision: revision,
  generatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
};
const presentation = {
  proposal: phaseZeroGraduationProposalViewSchema,
  proposalDigest: digest,
  approvalStatement: z.string().min(1).max(10_000),
  graduationApprovalConsumed: z.union([z.boolean(), z.literal("unknown")]),
  mergeApprovalStatement: z.string().min(1).max(10_000).nullable(),
  mergeApprovalConsumed: z.union([z.boolean(), z.literal("unknown")]),
  mergeContext: phaseZeroMergeApprovalContextSchema.nullable(),
};

export const phaseZeroGraduationEnvelopeSchema = z
  .discriminatedUnion("state", [
    z.strictObject({ ...envelopeBase, state: z.literal("idle") }),
    z.strictObject({ ...envelopeBase, state: z.literal("presented"), ...presentation }),
    z.strictObject({
      ...envelopeBase,
      state: z.literal("concluded"),
      ...presentation,
      result: phaseZeroGraduationResultTransportSchema,
    }),
  ])
  .superRefine((envelope, context) => {
    if (envelope.state === "idle") return;
    const initial = `I approve ${envelope.proposal.graduationId} at ${envelope.proposalDigest} for one deployed IRIS Phase 0 graduation execution exactly as proposed.`;
    if (envelope.approvalStatement !== initial)
      context.addIssue({
        code: "custom",
        path: ["approvalStatement"],
        message: "Initial approval statement does not bind the exact proposal.",
      });
    if (envelope.mergeContext === null) {
      if (envelope.mergeApprovalStatement !== null)
        context.addIssue({
          code: "custom",
          path: ["mergeApprovalStatement"],
          message: "Merge approval cannot exist without delivery and review context.",
        });
      return;
    }
    const merge = `I approve merge of ${envelope.mergeContext.deliveryCommit} from pull request #${String(envelope.mergeContext.pullRequestNumber)} for ${envelope.proposal.graduationId} at ${envelope.proposalDigest} after IRIS independent review of ${envelope.mergeContext.reviewedCommit}.`;
    if (envelope.mergeApprovalStatement !== merge)
      context.addIssue({
        code: "custom",
        path: ["mergeApprovalStatement"],
        message: "Merge approval statement does not bind delivery and review context.",
      });
  });

export const phaseZeroGraduationApprovalEnvelopeSchema = z.discriminatedUnion("approvalType", [
  z.strictObject({
    approvalType: z.literal("graduation"),
    approval: phaseZeroGraduationApprovalSchema,
  }),
  z.strictObject({
    approvalType: z.literal("merge"),
    approval: phaseZeroMergeApprovalSchema,
  }),
]);

export interface PhaseZeroGraduationTransportStore {
  read(): Promise<unknown>;
  consumeApproval(
    envelope: z.infer<typeof phaseZeroGraduationApprovalEnvelopeSchema>,
  ): Promise<unknown>;
}

/**
 * Strict transport boundary over an IRIS-owned authoritative store. The
 * controller deliberately owns no process-local ledger or graduation state.
 */
export class PhaseZeroGraduationReadinessController {
  readonly #store: PhaseZeroGraduationTransportStore;
  readonly #now: () => Date;

  constructor(store: PhaseZeroGraduationTransportStore, now: () => Date = () => new Date()) {
    this.#store = store;
    this.#now = now;
  }

  async read() {
    return phaseZeroGraduationEnvelopeSchema.parse(await this.#store.read());
  }

  async consumeApproval(input: unknown) {
    const envelope = phaseZeroGraduationApprovalEnvelopeSchema.parse(input);
    const receipt = phaseZeroApprovalConsumptionReceiptSchema.parse(
      await this.#store.consumeApproval(envelope),
    );
    if (
      receipt.approvalId !== envelope.approval.approvalId ||
      receipt.graduationId !== envelope.approval.graduationId ||
      receipt.proposalDigest !== envelope.approval.proposalDigest ||
      receipt.approvalType !== envelope.approvalType ||
      Date.parse(receipt.consumedAt) < Date.parse(envelope.approval.issuedAt) ||
      Date.parse(receipt.consumedAt) > this.#now().getTime()
    )
      throw new Error("PHASE_ZERO_APPROVAL_RECEIPT_MISMATCH");
    return receipt;
  }
}

export function createIdlePhaseZeroGraduationEnvelope(coreRevision: string, now: Date) {
  return phaseZeroGraduationEnvelopeSchema.parse({
    apiVersion: phaseZeroGraduationTransportVersion,
    state: "idle",
    coreRevision,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30_000).toISOString(),
  });
}
