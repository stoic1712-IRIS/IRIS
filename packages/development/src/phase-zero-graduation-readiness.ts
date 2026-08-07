import { createHash } from "node:crypto";

import { z } from "zod";

import {
  executableWorkerProposalDigest,
  executableWorkerProposalSchema,
} from "./executable-worker-contracts.js";

const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const safeIdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/u);
const safeBranchSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u)
  .refine((value) => !value.includes("..") && !value.endsWith("/"));

const forbiddenModelIdentity =
  /(?:fixture|fake|mock|test-model|stub|dummy|sim(?:ulated|ulation)?)/iu;
const protectedCandidatePath =
  /^(?:\.git|\.github|\.iris)(?:\/|$)|^(?:AGENTS|CLAUDE)\.md$|^docs\/(?:governance|registries)(?:\/|$)|^pnpm-lock\.yaml$/u;
const safeCandidatePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u)
  .refine(
    (value) =>
      !value.includes("..") &&
      !value.includes("\\") &&
      !value.endsWith("/") &&
      !protectedCandidatePath.test(value),
    { message: "Candidate path must be a safe unprotected repository-relative path." },
  );

export const phaseZeroGraduationProposalSchema = z
  .strictObject({
    graduationId: z.string().regex(/^graduation_phase0-[a-z0-9-]{8,100}$/u),
    actor: z.literal("IRIS"),
    producerId: z.literal("iris-development-worker"),
    canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
    canonicalBaseRevision: revisionSchema,
    commandCenterRepository: z.literal("stoic1712-IRIS/iris-founder-command-center"),
    commandCenterBaseRevision: revisionSchema,
    deploymentId: safeIdentifierSchema,
    deployedRuntime: z.literal(true),
    model: z
      .strictObject({
        provider: z.enum(["ollama", "lm-studio"]),
        name: z.string().trim().min(2).max(200),
        endpoint: z.literal("loopback"),
        realModel: z.literal(true),
        repositoryInspectionRevision: revisionSchema,
        repositoryInspectionDigest: digestSchema,
        inspectedAt: z.iso.datetime(),
      })
      .refine((model) => !forbiddenModelIdentity.test(model.name), {
        message: "Phase 0 requires a real non-fixture model identity.",
      }),
    executableWorkerProposalDigest: digestSchema,
    executableWorkerExecutionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
    executableWorkerProposal: executableWorkerProposalSchema,
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
    maximumRuntimeMs: z.number().int().min(60_000).max(3_600_000),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .superRefine((proposal, context) => {
    if (Date.parse(proposal.expiresAt) <= Date.parse(proposal.createdAt))
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Graduation proposal must expire after creation.",
      });
    const executable = proposal.executableWorkerProposal;
    if (
      executable.repository !== proposal.canonicalRepository ||
      executable.baseRevision !== proposal.canonicalBaseRevision ||
      executable.executionId !== proposal.executableWorkerExecutionId ||
      executable.branch !== proposal.candidateBranch ||
      executableWorkerProposalDigest(executable) !== proposal.executableWorkerProposalDigest ||
      executable.writePaths.length < 2 ||
      executable.maximumChangedFiles < executable.writePaths.length ||
      executable.writePaths.some((path) => !safeCandidatePathSchema.safeParse(path).success) ||
      Date.parse(executable.expiresAt) > Date.parse(proposal.expiresAt) ||
      JSON.stringify(executable.commands) !== JSON.stringify(proposal.verificationCommands)
    )
      context.addIssue({
        code: "custom",
        path: ["executableWorkerProposal"],
        message:
          "Nested executable-worker proposal must bind the canonical base, digest, branch, multi-file paths, and verification commands.",
      });
    if (proposal.model.repositoryInspectionRevision !== proposal.canonicalBaseRevision)
      context.addIssue({
        code: "custom",
        path: ["model", "repositoryInspectionRevision"],
        message: "Real-model repository inspection must bind the canonical base revision.",
      });
    if (Date.parse(proposal.model.inspectedAt) > Date.parse(proposal.createdAt))
      context.addIssue({
        code: "custom",
        path: ["model", "inspectedAt"],
        message: "Real-model repository inspection must precede proposal creation.",
      });
  });
export type PhaseZeroGraduationProposal = z.infer<typeof phaseZeroGraduationProposalSchema>;

export const phaseZeroGraduationApprovalSchema = z.strictObject({
  approvalId: z.string().regex(/^approval_phase0-[a-z0-9-]{8,100}$/u),
  graduationId: z.string().regex(/^graduation_phase0-[a-z0-9-]{8,100}$/u),
  proposalDigest: digestSchema,
  approvedBy: z.literal("Founder"),
  authentication: z.strictObject({
    actorId: z.literal("Founder"),
    sessionId: safeIdentifierSchema,
    assurance: z.literal("founder-loopback-session"),
    verified: z.literal(true),
    evidenceDigest: digestSchema,
    authenticatedAt: z.iso.datetime(),
  }),
  typedStatement: z.string().min(1).max(10_000),
  oneTime: z.literal(true),
  issuedAt: z.iso.datetime(),
});
export type PhaseZeroGraduationApproval = z.infer<typeof phaseZeroGraduationApprovalSchema>;

export const phaseZeroApprovalConsumptionReceiptSchema = z.strictObject({
  approvalId: z.string().regex(/^approval_(?:phase0|phase0-merge)-[a-z0-9-]{8,100}$/u),
  graduationId: z.string().regex(/^graduation_phase0-[a-z0-9-]{8,100}$/u),
  proposalDigest: digestSchema,
  approvalType: z.enum(["graduation", "merge"]),
  consumedBy: z.literal("IRIS"),
  durableLedger: z.literal(true),
  consumedAt: z.iso.datetime(),
});
export type PhaseZeroApprovalConsumptionReceipt = z.infer<
  typeof phaseZeroApprovalConsumptionReceiptSchema
>;

export function phaseZeroGraduationProposalDigest(proposal: PhaseZeroGraduationProposal): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(phaseZeroGraduationProposalSchema.parse(proposal)))
    .digest("hex")}`;
}

export function requiredPhaseZeroGraduationApproval(proposal: PhaseZeroGraduationProposal): string {
  return `I approve ${proposal.graduationId} at ${phaseZeroGraduationProposalDigest(proposal)} for one deployed IRIS Phase 0 graduation execution exactly as proposed.`;
}

export const phaseZeroPreflightSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  commandCenterRepository: z.literal("stoic1712-IRIS/iris-founder-command-center"),
  checkpointRepository: z.literal("stoic1712-IRIS/IRIS-checkpoints"),
  deployedRuntime: z.literal(true),
  deploymentId: safeIdentifierSchema,
  canonicalLocalRevision: revisionSchema,
  canonicalRemoteRevision: revisionSchema,
  providerMainRevision: revisionSchema,
  commandCenterRevision: revisionSchema,
  commandCenterConnected: z.literal(true),
  modelProvider: z.enum(["ollama", "lm-studio"]),
  modelName: z.string().min(2).max(200),
  modelReady: z.literal(true),
  checkpointRepositoryPrivate: z.literal(true),
  ephemeralCredentialReady: z.literal(true),
  codexMutationObserved: z.literal(false),
  claudeMutationObserved: z.literal(false),
  currentProviderResources: z.array(z.string().min(1).max(500)).max(100),
});
export type PhaseZeroPreflight = z.infer<typeof phaseZeroPreflightSchema>;

export const phaseZeroCandidateSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  executionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
  executableWorkerProposalDigest: digestSchema,
  producerId: z.literal("iris-development-worker"),
  status: z.literal("succeeded"),
  baseRevision: revisionSchema,
  candidateCommit: revisionSchema,
  baseTreeDigest: digestSchema,
  candidateTreeDigest: digestSchema,
  candidateDiffDigest: digestSchema,
  baseAncestorVerified: z.literal(true),
  diffVerified: z.literal(true),
  candidateRef: z.string().regex(/^refs\/heads\/iris\/candidate\/[a-z0-9][a-z0-9/-]{7,180}$/u),
  changedPaths: z
    .array(safeCandidatePathSchema)
    .min(2)
    .max(50)
    .refine((paths) => new Set(paths).size === paths.length, {
      message: "Candidate paths must be unique.",
    }),
  verificationCommands: z
    .array(z.array(z.string().min(1).max(500)).min(1).max(30))
    .min(1)
    .max(10),
  checksPassed: z.literal(true),
  workerApprovalConsumed: z.literal(true),
  eventChainVerified: z.literal(true),
  workspaceCleanupVerified: z.literal(true),
  protectedPathsUntouched: z.literal(true),
  codexMutationObserved: z.literal(false),
  claudeMutationObserved: z.literal(false),
  realModelObserved: z.literal(true),
  modelProvider: z.enum(["ollama", "lm-studio"]),
  modelName: z.string().min(2).max(200),
  modelEndpoint: z.literal("loopback"),
  repositoryInspectionDigest: digestSchema,
  modelResponseDigest: digestSchema,
  modelObservedAt: z.iso.datetime(),
});
export type PhaseZeroCandidate = z.infer<typeof phaseZeroCandidateSchema>;

export const phaseZeroIndependentReviewSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  reviewerId: z.literal("iris-independent-review-worker"),
  baseRevision: revisionSchema,
  reviewedCommit: revisionSchema,
  candidateTreeDigest: digestSchema,
  candidateDiffDigest: digestSchema,
  baseAncestorVerified: z.literal(true),
  diffVerified: z.literal(true),
  verdict: z.literal("pass"),
  findings: z.array(z.string().min(1).max(2_000)).max(100),
  verificationCommands: z
    .array(z.array(z.string().min(1).max(500)).min(1).max(30))
    .min(1)
    .max(10),
  checksPassed: z.literal(true),
  canonicalRepositoryChanged: z.literal(false),
  codexMutationObserved: z.literal(false),
  claudeMutationObserved: z.literal(false),
});
export type PhaseZeroIndependentReview = z.infer<typeof phaseZeroIndependentReviewSchema>;

export const phaseZeroDeliverySchema = z
  .strictObject({
    actor: z.literal("IRIS"),
    canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
    checkpointRepository: z.literal("stoic1712-IRIS/IRIS-checkpoints"),
    deliveryCommit: revisionSchema,
    checkpointRef: safeBranchSchema,
    checkpointCommit: revisionSchema,
    checkpointRemoteRevision: revisionSchema,
    checkpointCreatedFirst: z.literal(true),
    checkpointCreatedAt: z.iso.datetime(),
    targetBranch: safeBranchSchema,
    targetCommit: revisionSchema,
    targetRemoteRevision: revisionSchema,
    targetPushedAt: z.iso.datetime(),
    pullRequest: z.strictObject({
      repository: z.literal("stoic1712-IRIS/IRIS"),
      number: z.number().int().positive(),
      url: z.url(),
      headCommit: revisionSchema,
      draft: z.literal(true),
    }),
    credentialCleared: z.literal(true),
    workspaceCleanupVerified: z.literal(true),
    codexMutationObserved: z.literal(false),
    claudeMutationObserved: z.literal(false),
  })
  .superRefine((delivery, context) => {
    if (Date.parse(delivery.checkpointCreatedAt) >= Date.parse(delivery.targetPushedAt))
      context.addIssue({
        code: "custom",
        path: ["checkpointCreatedAt"],
        message: "Private checkpoint must be provider-observed before target delivery.",
      });
    if (
      delivery.pullRequest.url !==
      `https://github.com/${delivery.pullRequest.repository}/pull/${String(delivery.pullRequest.number)}`
    )
      context.addIssue({
        code: "custom",
        path: ["pullRequest", "url"],
        message: "Pull-request URL must bind the exact canonical repository and number.",
      });
  });
export type PhaseZeroDelivery = z.infer<typeof phaseZeroDeliverySchema>;

export const phaseZeroMergeApprovalSchema = z.strictObject({
  approvalId: z.string().regex(/^approval_phase0-merge-[a-z0-9-]{8,100}$/u),
  graduationId: z.string().regex(/^graduation_phase0-[a-z0-9-]{8,100}$/u),
  proposalDigest: digestSchema,
  deliveryCommit: revisionSchema,
  reviewedCommit: revisionSchema,
  pullRequestNumber: z.number().int().positive(),
  approvedBy: z.literal("Founder"),
  authentication: z.strictObject({
    actorId: z.literal("Founder"),
    sessionId: safeIdentifierSchema,
    assurance: z.literal("founder-loopback-session"),
    verified: z.literal(true),
    evidenceDigest: digestSchema,
    authenticatedAt: z.iso.datetime(),
  }),
  typedStatement: z.string().min(1).max(10_000),
  oneTime: z.literal(true),
  issuedAt: z.iso.datetime(),
});
export type PhaseZeroMergeApproval = z.infer<typeof phaseZeroMergeApprovalSchema>;

export function requiredPhaseZeroMergeApproval(
  proposal: PhaseZeroGraduationProposal,
  delivery: PhaseZeroDelivery,
  review: PhaseZeroIndependentReview,
): string {
  return `I approve merge of ${delivery.deliveryCommit} from pull request #${String(delivery.pullRequest.number)} for ${proposal.graduationId} at ${phaseZeroGraduationProposalDigest(proposal)} after IRIS independent review of ${review.reviewedCommit}.`;
}

export const phaseZeroMergeSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  providerActor: z.literal("stoic1712-IRIS"),
  providerActorVerified: z.literal(true),
  pullRequestNumber: z.number().int().positive(),
  expectedHeadCommit: revisionSchema,
  mergeCommit: revisionSchema,
  firstParentRevision: revisionSchema,
  secondParentRevision: revisionSchema,
  providerMainRevision: revisionSchema,
  mergeMethod: z.literal("merge-commit"),
  independentReviewConsumed: z.literal(true),
  mergeApprovalId: z.string().regex(/^approval_phase0-merge-[a-z0-9-]{8,100}$/u),
  mergeApprovalProposalDigest: digestSchema,
  codexMutationObserved: z.literal(false),
  claudeMutationObserved: z.literal(false),
});
export type PhaseZeroMerge = z.infer<typeof phaseZeroMergeSchema>;

export const phaseZeroCanonicalEqualitySchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  localMainRevision: revisionSchema,
  remoteMainRevision: revisionSchema,
  providerMainRevision: revisionSchema,
});
export type PhaseZeroCanonicalEquality = z.infer<typeof phaseZeroCanonicalEqualitySchema>;

export const phaseZeroRollbackEvidenceSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  mergeCommit: revisionSchema,
  strategy: z.literal("revert"),
  command: z.string().regex(/^git revert -m 1 [a-f0-9]{40}$/u),
  mergeCommitIsAncestor: z.literal(true),
  privateCheckpointRecoverable: z.literal(true),
  preservesHistory: z.literal(true),
});
export type PhaseZeroRollbackEvidence = z.infer<typeof phaseZeroRollbackEvidenceSchema>;

export const phaseZeroCleanupEvidenceSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  executionWorkspaceRemoved: z.literal(true),
  deliveryWorkspaceRemoved: z.literal(true),
  journalPreserved: z.literal(true),
  credentialCleared: z.literal(true),
});
export type PhaseZeroCleanupEvidence = z.infer<typeof phaseZeroCleanupEvidenceSchema>;

export const phaseZeroResourceTerminationSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  observedCostUsd: z.literal(0),
  terminatedResourceIds: z.array(z.string().min(1).max(500)).max(100),
  paidResourcesTerminated: z.literal(true),
  verifiedAt: z.iso.datetime(),
});
export type PhaseZeroResourceTermination = z.infer<typeof phaseZeroResourceTerminationSchema>;

export const phaseZeroProviderInspectionSchema = z.strictObject({
  actor: z.literal("IRIS"),
  canonicalRepository: z.literal("stoic1712-IRIS/IRIS"),
  provider: z.literal("github"),
  account: z.literal("stoic1712-IRIS"),
  scope: z.tuple([
    z.literal("stoic1712-IRIS/IRIS"),
    z.literal("stoic1712-IRIS/iris-founder-command-center"),
    z.literal("stoic1712-IRIS/IRIS-checkpoints"),
  ]),
  providerAuthoritative: z.literal(true),
  providerMainRevision: revisionSchema,
  resources: z.array(z.string().min(1).max(500)).max(100),
  verifiedAt: z.iso.datetime(),
});
export type PhaseZeroProviderInspection = z.infer<typeof phaseZeroProviderInspectionSchema>;

export const phaseZeroGraduationStages = [
  "approval",
  "preflight",
  "candidate",
  "independent-review",
  "delivery",
  "merge-approval",
  "merge",
  "canonical-equality",
  "rollback",
  "cleanup",
  "resource-termination",
  "provider-zero",
  "completed",
] as const;
export type PhaseZeroGraduationStage = (typeof phaseZeroGraduationStages)[number];

export interface PhaseZeroGraduationEvent {
  sequence: number;
  stage: PhaseZeroGraduationStage;
  summary: string;
  evidence: unknown;
  evidenceDigest: string;
  previousDigest: string | null;
  digest: string;
}

export interface PhaseZeroGraduationResult {
  graduationId: string;
  status: "succeeded" | "denied" | "failed";
  stage: PhaseZeroGraduationStage;
  failureStage?: PhaseZeroGraduationStage;
  summary: string;
  approvalConsumed: boolean | "unknown";
  mergeApprovalConsumed: boolean | "unknown";
  canonicalRepositoryChanged: boolean | null;
  canonicalRepositoryChangeVerified: boolean;
  phase0GraduationEvidenceComplete: boolean;
  providerZeroVerified: boolean;
  events: PhaseZeroGraduationEvent[];
  candidate?: PhaseZeroCandidate;
  review?: PhaseZeroIndependentReview;
  delivery?: PhaseZeroDelivery;
  merge?: PhaseZeroMerge;
  equality?: PhaseZeroCanonicalEquality;
  rollback?: PhaseZeroRollbackEvidence;
  cleanup?: PhaseZeroCleanupEvidence;
  graduationApprovalReceipt?: PhaseZeroApprovalConsumptionReceipt;
  mergeApprovalReceipt?: PhaseZeroApprovalConsumptionReceipt;
  resourceTermination?: PhaseZeroResourceTermination;
  providerInspection?: PhaseZeroProviderInspection;
}

export interface PhaseZeroGraduationAdapter {
  consumeGraduationApproval(
    proposal: PhaseZeroGraduationProposal,
    approval: PhaseZeroGraduationApproval,
  ): Promise<PhaseZeroApprovalConsumptionReceipt>;
  preflight(
    proposal: PhaseZeroGraduationProposal,
    signal: AbortSignal,
  ): Promise<PhaseZeroPreflight>;
  executeCandidate(
    proposal: PhaseZeroGraduationProposal,
    signal: AbortSignal,
  ): Promise<PhaseZeroCandidate>;
  independentlyReview(
    proposal: PhaseZeroGraduationProposal,
    candidate: PhaseZeroCandidate,
    signal: AbortSignal,
  ): Promise<PhaseZeroIndependentReview>;
  deliver(
    proposal: PhaseZeroGraduationProposal,
    candidate: PhaseZeroCandidate,
    review: PhaseZeroIndependentReview,
    signal: AbortSignal,
  ): Promise<PhaseZeroDelivery>;
  readMergeApproval(
    proposal: PhaseZeroGraduationProposal,
    delivery: PhaseZeroDelivery,
    review: PhaseZeroIndependentReview,
    signal: AbortSignal,
  ): Promise<PhaseZeroMergeApproval>;
  consumeMergeApproval(
    proposal: PhaseZeroGraduationProposal,
    approval: PhaseZeroMergeApproval,
  ): Promise<PhaseZeroApprovalConsumptionReceipt>;
  merge(
    proposal: PhaseZeroGraduationProposal,
    delivery: PhaseZeroDelivery,
    review: PhaseZeroIndependentReview,
    mergeApprovalReceipt: PhaseZeroApprovalConsumptionReceipt,
    signal: AbortSignal,
  ): Promise<PhaseZeroMerge>;
  verifyCanonicalEquality(
    proposal: PhaseZeroGraduationProposal,
    merge: PhaseZeroMerge,
  ): Promise<PhaseZeroCanonicalEquality>;
  preserveRollbackEvidence(
    proposal: PhaseZeroGraduationProposal,
    merge: PhaseZeroMerge,
    delivery: PhaseZeroDelivery,
  ): Promise<PhaseZeroRollbackEvidence>;
  cleanup(proposal: PhaseZeroGraduationProposal): Promise<PhaseZeroCleanupEvidence>;
  terminatePaidResources(
    proposal: PhaseZeroGraduationProposal,
  ): Promise<PhaseZeroResourceTermination>;
  providerResources(proposal: PhaseZeroGraduationProposal): Promise<PhaseZeroProviderInspection>;
}

class GraduationInvariantError extends Error {
  constructor(readonly stage: PhaseZeroGraduationStage) {
    super(`PHASE_ZERO_GRADUATION_INVARIANT:${stage}`);
  }
}

function assertInvariant(condition: boolean, stage: PhaseZeroGraduationStage): asserts condition {
  if (!condition) throw new GraduationInvariantError(stage);
}

function eventDigest(event: Omit<PhaseZeroGraduationEvent, "digest">): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(event)).digest("hex")}`;
}

function evidenceDigest(evidence: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(evidence)).digest("hex")}`;
}

export function verifyPhaseZeroGraduationEventChain(
  events: readonly PhaseZeroGraduationEvent[],
): boolean {
  let previousDigest: string | null = null;
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1 || event.previousDigest !== previousDigest) return false;
    if (event.evidenceDigest !== evidenceDigest(event.evidence)) return false;
    const { digest, ...unsigned } = event;
    if (digest !== eventDigest(unsigned)) return false;
    previousDigest = digest;
  }
  return true;
}

function approvalMatches(
  proposal: PhaseZeroGraduationProposal,
  approval: PhaseZeroGraduationApproval,
): boolean {
  return (
    approval.graduationId === proposal.graduationId &&
    approval.proposalDigest === phaseZeroGraduationProposalDigest(proposal) &&
    approval.typedStatement === requiredPhaseZeroGraduationApproval(proposal) &&
    Date.parse(approval.authentication.authenticatedAt) <= Date.parse(approval.issuedAt) &&
    Date.parse(approval.issuedAt) >= Date.parse(proposal.createdAt) &&
    Date.parse(approval.issuedAt) < Date.parse(proposal.expiresAt)
  );
}

function receiptMatches(
  proposal: PhaseZeroGraduationProposal,
  approvalId: string,
  approvalType: PhaseZeroApprovalConsumptionReceipt["approvalType"],
  receipt: PhaseZeroApprovalConsumptionReceipt,
): boolean {
  return (
    receipt.approvalId === approvalId &&
    receipt.graduationId === proposal.graduationId &&
    receipt.proposalDigest === phaseZeroGraduationProposalDigest(proposal) &&
    receipt.approvalType === approvalType
  );
}

function mergeApprovalMatches(
  proposal: PhaseZeroGraduationProposal,
  delivery: PhaseZeroDelivery,
  review: PhaseZeroIndependentReview,
  approval: PhaseZeroMergeApproval,
): boolean {
  return (
    approval.graduationId === proposal.graduationId &&
    approval.proposalDigest === phaseZeroGraduationProposalDigest(proposal) &&
    approval.deliveryCommit === delivery.deliveryCommit &&
    approval.reviewedCommit === review.reviewedCommit &&
    approval.pullRequestNumber === delivery.pullRequest.number &&
    approval.typedStatement === requiredPhaseZeroMergeApproval(proposal, delivery, review) &&
    Date.parse(approval.authentication.authenticatedAt) <= Date.parse(approval.issuedAt) &&
    Date.parse(approval.issuedAt) >= Date.parse(delivery.targetPushedAt) &&
    Date.parse(approval.issuedAt) < Date.parse(proposal.expiresAt)
  );
}

export class PhaseZeroGraduationRuntime {
  readonly #adapter: PhaseZeroGraduationAdapter;
  readonly #now: () => Date;

  constructor(options: { adapter: PhaseZeroGraduationAdapter; now?: () => Date }) {
    this.#adapter = options.adapter;
    this.#now = options.now ?? (() => new Date());
  }

  async execute(
    proposalInput: PhaseZeroGraduationProposal,
    approvalInput: PhaseZeroGraduationApproval,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PhaseZeroGraduationResult> {
    const proposal = phaseZeroGraduationProposalSchema.parse(proposalInput);
    const approval = phaseZeroGraduationApprovalSchema.parse(approvalInput);
    const events: PhaseZeroGraduationEvent[] = [];
    let stage: PhaseZeroGraduationStage = "approval";
    let attemptedStage: PhaseZeroGraduationStage = "approval";
    let failureStage: PhaseZeroGraduationStage | undefined;
    let candidate: PhaseZeroCandidate | undefined;
    let review: PhaseZeroIndependentReview | undefined;
    let delivery: PhaseZeroDelivery | undefined;
    let merge: PhaseZeroMerge | undefined;
    let equality: PhaseZeroCanonicalEquality | undefined;
    let rollback: PhaseZeroRollbackEvidence | undefined;
    let cleanup: PhaseZeroCleanupEvidence | undefined;
    let graduationApprovalReceipt: PhaseZeroApprovalConsumptionReceipt | undefined;
    let mergeApprovalReceipt: PhaseZeroApprovalConsumptionReceipt | undefined;
    let graduationApprovalConsumed: boolean | "unknown" = false;
    let mergeApprovalConsumed: boolean | "unknown" = false;
    let resourceTermination: PhaseZeroResourceTermination | undefined;
    let providerInspection: PhaseZeroProviderInspection | undefined;
    let canonicalRepositoryChanged: boolean | null = null;
    let canonicalRepositoryChangeVerified = false;

    const emit = (nextStage: PhaseZeroGraduationStage, summary: string, evidence: unknown) => {
      stage = nextStage;
      const unsigned = {
        sequence: events.length + 1,
        stage: nextStage,
        summary,
        evidence,
        evidenceDigest: evidenceDigest(evidence),
        previousDigest: events.at(-1)?.digest ?? null,
      };
      events.push({ ...unsigned, digest: eventDigest(unsigned) });
    };
    const result = (
      status: PhaseZeroGraduationResult["status"],
      summary: string,
      providerZeroVerified: boolean,
    ): PhaseZeroGraduationResult => ({
      graduationId: proposal.graduationId,
      status,
      stage: status === "failed" && failureStage !== undefined ? failureStage : stage,
      ...(failureStage === undefined ? {} : { failureStage }),
      summary,
      approvalConsumed: graduationApprovalConsumed,
      mergeApprovalConsumed,
      canonicalRepositoryChanged,
      canonicalRepositoryChangeVerified,
      phase0GraduationEvidenceComplete:
        status === "succeeded" &&
        graduationApprovalConsumed === true &&
        mergeApprovalConsumed === true &&
        graduationApprovalReceipt !== undefined &&
        mergeApprovalReceipt !== undefined &&
        candidate !== undefined &&
        review !== undefined &&
        delivery !== undefined &&
        merge !== undefined &&
        equality !== undefined &&
        rollback !== undefined &&
        cleanup !== undefined &&
        resourceTermination !== undefined &&
        providerInspection !== undefined &&
        canonicalRepositoryChanged === true &&
        canonicalRepositoryChangeVerified &&
        providerZeroVerified,
      providerZeroVerified,
      events,
      ...(candidate === undefined ? {} : { candidate }),
      ...(review === undefined ? {} : { review }),
      ...(delivery === undefined ? {} : { delivery }),
      ...(merge === undefined ? {} : { merge }),
      ...(equality === undefined ? {} : { equality }),
      ...(rollback === undefined ? {} : { rollback }),
      ...(cleanup === undefined ? {} : { cleanup }),
      ...(graduationApprovalReceipt === undefined ? {} : { graduationApprovalReceipt }),
      ...(mergeApprovalReceipt === undefined ? {} : { mergeApprovalReceipt }),
      ...(resourceTermination === undefined ? {} : { resourceTermination }),
      ...(providerInspection === undefined ? {} : { providerInspection }),
    });

    if (
      !approvalMatches(proposal, approval) ||
      Date.parse(proposal.createdAt) > this.#now().getTime() ||
      Date.parse(approval.issuedAt) > this.#now().getTime() ||
      Date.parse(proposal.expiresAt) <= this.#now().getTime()
    ) {
      emit("approval", "Exact one-time Founder approval was denied or expired.", {
        approvalId: approval.approvalId,
        proposalDigest: approval.proposalDigest,
        consumed: false,
      });
      return result("denied", "Phase 0 graduation did not start.", false);
    }

    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(proposal.maximumRuntimeMs)]);

    try {
      graduationApprovalConsumed = "unknown";
      graduationApprovalReceipt = phaseZeroApprovalConsumptionReceiptSchema.parse(
        await this.#adapter.consumeGraduationApproval(proposal, approval),
      );
      assertInvariant(
        receiptMatches(proposal, approval.approvalId, "graduation", graduationApprovalReceipt) &&
          Date.parse(graduationApprovalReceipt.consumedAt) >= Date.parse(approval.issuedAt) &&
          Date.parse(graduationApprovalReceipt.consumedAt) <= this.#now().getTime(),
        "approval",
      );
      graduationApprovalConsumed = true;
    } catch {
      graduationApprovalReceipt = undefined;
      emit(
        "approval",
        "The durable ledger did not return verified approval-consumption evidence.",
        {
          approvalId: approval.approvalId,
          proposalDigest: approval.proposalDigest,
          consumed: "unknown",
        },
      );
      return result(
        "denied",
        "Phase 0 graduation stopped with unknown approval-consumption state.",
        false,
      );
    }
    emit(
      "approval",
      "Exact one-time Founder approval was durably consumed by deployed IRIS.",
      graduationApprovalReceipt,
    );

    try {
      attemptedStage = "preflight";
      boundedSignal.throwIfAborted();
      const preflight = phaseZeroPreflightSchema.parse(
        await this.#adapter.preflight(proposal, boundedSignal),
      );
      assertInvariant(preflight.deploymentId === proposal.deploymentId, "preflight");
      assertInvariant(
        preflight.canonicalLocalRevision === proposal.canonicalBaseRevision &&
          preflight.canonicalRemoteRevision === proposal.canonicalBaseRevision &&
          preflight.providerMainRevision === proposal.canonicalBaseRevision,
        "preflight",
      );
      assertInvariant(
        preflight.commandCenterRevision === proposal.commandCenterBaseRevision,
        "preflight",
      );
      assertInvariant(
        preflight.modelProvider === proposal.model.provider &&
          preflight.modelName === proposal.model.name &&
          !forbiddenModelIdentity.test(preflight.modelName),
        "preflight",
      );
      assertInvariant(preflight.currentProviderResources.length === 0, "preflight");
      canonicalRepositoryChanged = false;
      canonicalRepositoryChangeVerified = true;
      emit(
        "preflight",
        "Deployment, model, repository, checkpoint, and provider state matched.",
        preflight,
      );

      attemptedStage = "candidate";
      boundedSignal.throwIfAborted();
      candidate = phaseZeroCandidateSchema.parse(
        await this.#adapter.executeCandidate(proposal, boundedSignal),
      );
      assertInvariant(
        candidate.executableWorkerProposalDigest === proposal.executableWorkerProposalDigest &&
          candidate.executionId === proposal.executableWorkerExecutionId &&
          candidate.baseRevision === proposal.canonicalBaseRevision &&
          candidate.candidateCommit !== proposal.canonicalBaseRevision &&
          candidate.baseTreeDigest !== candidate.candidateTreeDigest &&
          candidate.candidateRef === `refs/heads/${proposal.candidateBranch}` &&
          candidate.repositoryInspectionDigest === proposal.model.repositoryInspectionDigest &&
          candidate.modelProvider === proposal.model.provider &&
          candidate.modelName === proposal.model.name &&
          Date.parse(candidate.modelObservedAt) >= Date.parse(proposal.model.inspectedAt) &&
          Date.parse(candidate.modelObservedAt) <= this.#now().getTime() &&
          JSON.stringify(candidate.changedPaths) ===
            JSON.stringify(proposal.executableWorkerProposal.writePaths) &&
          JSON.stringify(candidate.verificationCommands) ===
            JSON.stringify(proposal.verificationCommands),
        "candidate",
      );
      emit(
        "candidate",
        "The real-model executable worker produced a verified local candidate.",
        candidate,
      );

      attemptedStage = "independent-review";
      boundedSignal.throwIfAborted();
      review = phaseZeroIndependentReviewSchema.parse(
        await this.#adapter.independentlyReview(proposal, candidate, boundedSignal),
      );
      assertInvariant(
        review.baseRevision === candidate.baseRevision &&
          review.reviewedCommit === candidate.candidateCommit &&
          review.candidateTreeDigest === candidate.candidateTreeDigest &&
          review.candidateDiffDigest === candidate.candidateDiffDigest &&
          review.findings.length === 0 &&
          JSON.stringify(review.verificationCommands) ===
            JSON.stringify(proposal.verificationCommands),
        "independent-review",
      );
      emit(
        "independent-review",
        "A distinct IRIS reviewer passed the exact candidate commit.",
        review,
      );

      attemptedStage = "delivery";
      boundedSignal.throwIfAborted();
      delivery = phaseZeroDeliverySchema.parse(
        await this.#adapter.deliver(proposal, candidate, review, boundedSignal),
      );
      assertInvariant(
        delivery.deliveryCommit === candidate.candidateCommit &&
          delivery.checkpointRef === proposal.checkpointRef &&
          delivery.targetBranch === proposal.targetBranch &&
          delivery.checkpointCommit === delivery.deliveryCommit &&
          delivery.checkpointRemoteRevision === delivery.deliveryCommit &&
          delivery.targetCommit === delivery.deliveryCommit &&
          delivery.targetRemoteRevision === delivery.deliveryCommit &&
          delivery.pullRequest.headCommit === delivery.deliveryCommit &&
          Date.parse(delivery.checkpointCreatedAt) <= this.#now().getTime() &&
          Date.parse(delivery.targetPushedAt) <= this.#now().getTime(),
        "delivery",
      );
      emit(
        "delivery",
        "Private checkpoint and target branch matched before pull-request delivery.",
        delivery,
      );

      attemptedStage = "merge-approval";
      boundedSignal.throwIfAborted();
      const mergeApproval = phaseZeroMergeApprovalSchema.parse(
        await this.#adapter.readMergeApproval(proposal, delivery, review, boundedSignal),
      );
      assertInvariant(
        mergeApprovalMatches(proposal, delivery, review, mergeApproval) &&
          Date.parse(mergeApproval.issuedAt) <= this.#now().getTime() &&
          Date.parse(proposal.expiresAt) > this.#now().getTime(),
        "merge-approval",
      );
      mergeApprovalConsumed = "unknown";
      mergeApprovalReceipt = phaseZeroApprovalConsumptionReceiptSchema.parse(
        await this.#adapter.consumeMergeApproval(proposal, mergeApproval),
      );
      assertInvariant(
        receiptMatches(proposal, mergeApproval.approvalId, "merge", mergeApprovalReceipt) &&
          Date.parse(mergeApprovalReceipt.consumedAt) >= Date.parse(mergeApproval.issuedAt) &&
          Date.parse(mergeApprovalReceipt.consumedAt) <= this.#now().getTime(),
        "merge-approval",
      );
      mergeApprovalConsumed = true;
      emit(
        "merge-approval",
        "A separate digest-bound Founder merge approval was durably consumed by IRIS.",
        mergeApprovalReceipt,
      );

      attemptedStage = "merge";
      boundedSignal.throwIfAborted();
      merge = phaseZeroMergeSchema.parse(
        await this.#adapter.merge(proposal, delivery, review, mergeApprovalReceipt, boundedSignal),
      );
      assertInvariant(
        merge.pullRequestNumber === delivery.pullRequest.number &&
          merge.expectedHeadCommit === delivery.deliveryCommit &&
          merge.mergeCommit !== delivery.deliveryCommit &&
          merge.firstParentRevision === proposal.canonicalBaseRevision &&
          merge.secondParentRevision === delivery.deliveryCommit &&
          merge.providerMainRevision === merge.mergeCommit &&
          merge.mergeApprovalId === mergeApprovalReceipt.approvalId &&
          merge.mergeApprovalProposalDigest === mergeApprovalReceipt.proposalDigest,
        "merge",
      );
      canonicalRepositoryChanged = true;
      canonicalRepositoryChangeVerified = true;
      emit(
        "merge",
        "The independently reviewed exact head commit merged without history rewrite.",
        merge,
      );

      attemptedStage = "canonical-equality";
      boundedSignal.throwIfAborted();
      equality = phaseZeroCanonicalEqualitySchema.parse(
        await this.#adapter.verifyCanonicalEquality(proposal, merge),
      );
      assertInvariant(
        equality.localMainRevision === merge.mergeCommit &&
          equality.remoteMainRevision === merge.mergeCommit &&
          equality.providerMainRevision === merge.mergeCommit,
        "canonical-equality",
      );
      emit(
        "canonical-equality",
        "Local, remote, and provider-authoritative main revisions matched.",
        equality,
      );

      attemptedStage = "rollback";
      boundedSignal.throwIfAborted();
      rollback = phaseZeroRollbackEvidenceSchema.parse(
        await this.#adapter.preserveRollbackEvidence(proposal, merge, delivery),
      );
      assertInvariant(
        rollback.mergeCommit === merge.mergeCommit &&
          rollback.command === `git revert -m 1 ${merge.mergeCommit}`,
        "rollback",
      );
      emit(
        "rollback",
        "History-preserving rollback and private checkpoint recovery were proven.",
        rollback,
      );

      attemptedStage = "cleanup";
      boundedSignal.throwIfAborted();
      cleanup = phaseZeroCleanupEvidenceSchema.parse(await this.#adapter.cleanup(proposal));
      emit(
        "cleanup",
        "Execution and delivery workspaces were removed while the journal remained.",
        cleanup,
      );

      attemptedStage = "resource-termination";
      boundedSignal.throwIfAborted();
      const observedResourceTermination = phaseZeroResourceTerminationSchema.parse(
        await this.#adapter.terminatePaidResources(proposal),
      );
      assertInvariant(
        Date.parse(observedResourceTermination.verifiedAt) <= this.#now().getTime(),
        "resource-termination",
      );
      resourceTermination = observedResourceTermination;
      emit(
        "resource-termination",
        "IRIS recorded zero cost and verified termination of every scoped paid resource.",
        resourceTermination,
      );

      attemptedStage = "provider-zero";
      boundedSignal.throwIfAborted();
      const observedProviderInspection = phaseZeroProviderInspectionSchema.parse(
        await this.#adapter.providerResources(proposal),
      );
      assertInvariant(
        Date.parse(observedProviderInspection.verifiedAt) <= this.#now().getTime(),
        "provider-zero",
      );
      providerInspection = observedProviderInspection;
      canonicalRepositoryChanged =
        providerInspection.providerMainRevision !== proposal.canonicalBaseRevision;
      canonicalRepositoryChangeVerified = true;
      assertInvariant(
        providerInspection.providerMainRevision === merge.mergeCommit &&
          providerInspection.resources.length === 0,
        "provider-zero",
      );
      emit(
        "provider-zero",
        "Provider-authoritative inspection reported zero remaining resources.",
        providerInspection,
      );
      emit("completed", "IRIS completed the exact deployed Phase 0 graduation evidence chain.", {
        graduationId: proposal.graduationId,
        finalProviderMainRevision: providerInspection.providerMainRevision,
        providerZeroVerified: true,
      });
      return result("succeeded", "Phase 0 graduation evidence is complete.", true);
    } catch (error) {
      failureStage = error instanceof GraduationInvariantError ? error.stage : attemptedStage;
      emit(failureStage, `Phase 0 graduation failed closed during ${failureStage}.`, {
        graduationId: proposal.graduationId,
        failureStage,
        errorType:
          error instanceof GraduationInvariantError ? "graduation-invariant" : "adapter-or-schema",
      });

      if (cleanup === undefined) {
        try {
          cleanup = phaseZeroCleanupEvidenceSchema.parse(await this.#adapter.cleanup(proposal));
          emit(
            "cleanup",
            "Failure-path cleanup was verified and the journal was preserved.",
            cleanup,
          );
        } catch {
          emit("cleanup", "Failure-path cleanup could not be verified.", {
            graduationId: proposal.graduationId,
            verified: false,
          });
        }
      }

      if (resourceTermination === undefined) {
        try {
          const observedResourceTermination = phaseZeroResourceTerminationSchema.parse(
            await this.#adapter.terminatePaidResources(proposal),
          );
          if (Date.parse(observedResourceTermination.verifiedAt) > this.#now().getTime())
            emit(
              "resource-termination",
              "Failure-path paid-resource termination evidence was future-dated and rejected.",
              { graduationId: proposal.graduationId, verified: false },
            );
          else {
            resourceTermination = observedResourceTermination;
            emit(
              "resource-termination",
              "Failure-path paid-resource termination was provider-verifiable.",
              resourceTermination,
            );
          }
        } catch {
          emit("resource-termination", "Failure-path paid-resource termination was not verified.", {
            graduationId: proposal.graduationId,
            verified: false,
          });
        }
      }

      let providerZeroVerified = false;
      try {
        if (providerInspection === undefined) {
          const observedProviderInspection = phaseZeroProviderInspectionSchema.parse(
            await this.#adapter.providerResources(proposal),
          );
          if (Date.parse(observedProviderInspection.verifiedAt) <= this.#now().getTime())
            providerInspection = observedProviderInspection;
        }
        if (providerInspection === undefined) {
          canonicalRepositoryChanged = null;
          canonicalRepositoryChangeVerified = false;
          emit(
            "provider-zero",
            "Provider-authoritative repository and resource state was future-dated and rejected.",
            { graduationId: proposal.graduationId, verified: false },
          );
        } else {
          canonicalRepositoryChanged =
            providerInspection.providerMainRevision !== proposal.canonicalBaseRevision;
          canonicalRepositoryChangeVerified = true;
          providerZeroVerified = providerInspection.resources.length === 0;
          emit(
            "provider-zero",
            providerZeroVerified
              ? "Failure-path provider-authoritative inspection reported zero resources."
              : "Failure-path provider-authoritative inspection found remaining resources.",
            providerInspection,
          );
        }
      } catch {
        canonicalRepositoryChanged = null;
        canonicalRepositoryChangeVerified = false;
        emit("provider-zero", "Provider-authoritative repository and resource state is unknown.", {
          graduationId: proposal.graduationId,
          verified: false,
        });
      }
      return result(
        "failed",
        `Phase 0 graduation failed closed during ${failureStage}.`,
        providerZeroVerified,
      );
    }
  }
}
