import { createHash } from "node:crypto";

import { z } from "zod";

const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const safeIdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/u);
const safeBranchSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u)
  .refine((value) => !value.includes("..") && !value.endsWith("/"));

const forbiddenModelIdentity = /(?:fixture|fake|mock|test-model)/iu;

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
      })
      .refine((model) => !forbiddenModelIdentity.test(model.name), {
        message: "Phase 0 requires a real non-fixture model identity.",
      }),
    executableWorkerProposalDigest: digestSchema,
    executableWorkerExecutionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
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
  });
export type PhaseZeroGraduationProposal = z.infer<typeof phaseZeroGraduationProposalSchema>;

export const phaseZeroGraduationApprovalSchema = z.strictObject({
  approvalId: z.string().regex(/^approval_phase0-[a-z0-9-]{8,100}$/u),
  graduationId: z.string().regex(/^graduation_phase0-[a-z0-9-]{8,100}$/u),
  proposalDigest: digestSchema,
  approvedBy: z.literal("Founder"),
  typedStatement: z.string().min(1).max(10_000),
  oneTime: z.literal(true),
  issuedAt: z.iso.datetime(),
});
export type PhaseZeroGraduationApproval = z.infer<typeof phaseZeroGraduationApprovalSchema>;

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
  currentProviderResources: z.array(z.string().min(1).max(500)).max(100),
});
export type PhaseZeroPreflight = z.infer<typeof phaseZeroPreflightSchema>;

export const phaseZeroCandidateSchema = z.strictObject({
  executionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
  executableWorkerProposalDigest: digestSchema,
  producerId: z.literal("iris-development-worker"),
  status: z.literal("succeeded"),
  candidateCommit: revisionSchema,
  candidateRef: z.string().regex(/^refs\/heads\/iris\/candidate\/[a-z0-9][a-z0-9/-]{7,180}$/u),
  changedPaths: z.array(z.string().min(1).max(500)).min(1).max(50),
  verificationCommands: z
    .array(z.array(z.string().min(1).max(500)).min(1).max(30))
    .min(1)
    .max(10),
  checksPassed: z.literal(true),
  workerApprovalConsumed: z.literal(true),
  eventChainVerified: z.literal(true),
  workspaceCleanupVerified: z.literal(true),
  realModelObserved: z.literal(true),
  modelProvider: z.enum(["ollama", "lm-studio"]),
  modelName: z.string().min(2).max(200),
});
export type PhaseZeroCandidate = z.infer<typeof phaseZeroCandidateSchema>;

export const phaseZeroIndependentReviewSchema = z.strictObject({
  reviewerId: safeIdentifierSchema,
  reviewedCommit: revisionSchema,
  verdict: z.literal("pass"),
  findings: z.array(z.string().min(1).max(2_000)).max(100),
  verificationCommands: z
    .array(z.array(z.string().min(1).max(500)).min(1).max(30))
    .min(1)
    .max(10),
  checksPassed: z.literal(true),
  canonicalRepositoryChanged: z.literal(false),
});
export type PhaseZeroIndependentReview = z.infer<typeof phaseZeroIndependentReviewSchema>;

export const phaseZeroDeliverySchema = z.strictObject({
  deliveryCommit: revisionSchema,
  checkpointRef: safeBranchSchema,
  checkpointCommit: revisionSchema,
  checkpointRemoteRevision: revisionSchema,
  checkpointCreatedFirst: z.literal(true),
  targetBranch: safeBranchSchema,
  targetCommit: revisionSchema,
  targetRemoteRevision: revisionSchema,
  pullRequest: z.strictObject({
    number: z.number().int().positive(),
    url: z.url(),
    headCommit: revisionSchema,
    draft: z.literal(true),
  }),
  credentialCleared: z.literal(true),
  workspaceCleanupVerified: z.literal(true),
});
export type PhaseZeroDelivery = z.infer<typeof phaseZeroDeliverySchema>;

export const phaseZeroMergeSchema = z.strictObject({
  pullRequestNumber: z.number().int().positive(),
  expectedHeadCommit: revisionSchema,
  mergeCommit: revisionSchema,
  providerMainRevision: revisionSchema,
  mergeMethod: z.literal("merge-commit"),
  independentReviewConsumed: z.literal(true),
  mergeApprovalConsumed: z.literal(true),
});
export type PhaseZeroMerge = z.infer<typeof phaseZeroMergeSchema>;

export const phaseZeroCanonicalEqualitySchema = z.strictObject({
  localMainRevision: revisionSchema,
  remoteMainRevision: revisionSchema,
  providerMainRevision: revisionSchema,
});
export type PhaseZeroCanonicalEquality = z.infer<typeof phaseZeroCanonicalEqualitySchema>;

export const phaseZeroRollbackEvidenceSchema = z.strictObject({
  mergeCommit: revisionSchema,
  strategy: z.literal("revert"),
  command: z.string().regex(/^git revert [a-f0-9]{40}$/u),
  mergeCommitIsAncestor: z.literal(true),
  privateCheckpointRecoverable: z.literal(true),
  preservesHistory: z.literal(true),
});
export type PhaseZeroRollbackEvidence = z.infer<typeof phaseZeroRollbackEvidenceSchema>;

export const phaseZeroCleanupEvidenceSchema = z.strictObject({
  executionWorkspaceRemoved: z.literal(true),
  deliveryWorkspaceRemoved: z.literal(true),
  journalPreserved: z.literal(true),
  credentialCleared: z.literal(true),
});
export type PhaseZeroCleanupEvidence = z.infer<typeof phaseZeroCleanupEvidenceSchema>;

export type PhaseZeroGraduationStage =
  | "approval"
  | "preflight"
  | "candidate"
  | "independent-review"
  | "delivery"
  | "merge"
  | "canonical-equality"
  | "rollback"
  | "cleanup"
  | "provider-zero"
  | "completed";

export interface PhaseZeroGraduationEvent {
  sequence: number;
  stage: PhaseZeroGraduationStage;
  summary: string;
  previousDigest: string | null;
  digest: string;
}

export interface PhaseZeroGraduationResult {
  graduationId: string;
  status: "succeeded" | "denied" | "failed";
  stage: PhaseZeroGraduationStage;
  summary: string;
  approvalConsumed: boolean;
  canonicalRepositoryChanged: boolean;
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
}

export interface PhaseZeroGraduationApprovalState {
  consumed: boolean;
}

export interface PhaseZeroGraduationAdapter {
  preflight(proposal: PhaseZeroGraduationProposal): Promise<PhaseZeroPreflight>;
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
  merge(
    proposal: PhaseZeroGraduationProposal,
    delivery: PhaseZeroDelivery,
    review: PhaseZeroIndependentReview,
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
  terminatePaidResources(proposal: PhaseZeroGraduationProposal): Promise<string[]>;
  providerResources(proposal: PhaseZeroGraduationProposal): Promise<string[]>;
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

function approvalMatches(
  proposal: PhaseZeroGraduationProposal,
  approval: PhaseZeroGraduationApproval,
): boolean {
  return (
    approval.graduationId === proposal.graduationId &&
    approval.proposalDigest === phaseZeroGraduationProposalDigest(proposal) &&
    approval.typedStatement === requiredPhaseZeroGraduationApproval(proposal) &&
    Date.parse(approval.issuedAt) >= Date.parse(proposal.createdAt) &&
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
    approvalState: PhaseZeroGraduationApprovalState,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PhaseZeroGraduationResult> {
    const proposal = phaseZeroGraduationProposalSchema.parse(proposalInput);
    const approval = phaseZeroGraduationApprovalSchema.parse(approvalInput);
    const events: PhaseZeroGraduationEvent[] = [];
    let stage: PhaseZeroGraduationStage = "approval";
    let candidate: PhaseZeroCandidate | undefined;
    let review: PhaseZeroIndependentReview | undefined;
    let delivery: PhaseZeroDelivery | undefined;
    let merge: PhaseZeroMerge | undefined;
    let equality: PhaseZeroCanonicalEquality | undefined;
    let rollback: PhaseZeroRollbackEvidence | undefined;
    let cleanup: PhaseZeroCleanupEvidence | undefined;

    const emit = (nextStage: PhaseZeroGraduationStage, summary: string) => {
      stage = nextStage;
      const unsigned = {
        sequence: events.length + 1,
        stage: nextStage,
        summary,
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
      stage,
      summary,
      approvalConsumed: approvalState.consumed,
      canonicalRepositoryChanged: merge !== undefined,
      phase0GraduationEvidenceComplete:
        status === "succeeded" &&
        equality !== undefined &&
        rollback !== undefined &&
        cleanup !== undefined &&
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
    });

    if (
      approvalState.consumed ||
      !approvalMatches(proposal, approval) ||
      Date.parse(proposal.expiresAt) <= this.#now().getTime()
    ) {
      emit("approval", "Exact one-time Founder approval was denied or expired.");
      return result("denied", "Phase 0 graduation did not start.", false);
    }

    approvalState.consumed = true;
    emit("approval", "Exact one-time Founder approval was consumed by deployed IRIS.");
    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(proposal.maximumRuntimeMs)]);

    try {
      const preflight = phaseZeroPreflightSchema.parse(await this.#adapter.preflight(proposal));
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
      emit("preflight", "Deployment, model, repository, checkpoint, and provider state matched.");

      candidate = phaseZeroCandidateSchema.parse(
        await this.#adapter.executeCandidate(proposal, boundedSignal),
      );
      assertInvariant(
        candidate.executableWorkerProposalDigest === proposal.executableWorkerProposalDigest &&
          candidate.executionId === proposal.executableWorkerExecutionId &&
          candidate.candidateRef === `refs/heads/${proposal.candidateBranch}` &&
          candidate.modelProvider === proposal.model.provider &&
          candidate.modelName === proposal.model.name &&
          JSON.stringify(candidate.verificationCommands) ===
            JSON.stringify(proposal.verificationCommands),
        "candidate",
      );
      emit("candidate", "The real-model executable worker produced a verified local candidate.");

      review = phaseZeroIndependentReviewSchema.parse(
        await this.#adapter.independentlyReview(proposal, candidate, boundedSignal),
      );
      assertInvariant(
        review.reviewerId !== proposal.producerId &&
          review.reviewedCommit === candidate.candidateCommit &&
          review.findings.length === 0 &&
          JSON.stringify(review.verificationCommands) ===
            JSON.stringify(proposal.verificationCommands),
        "independent-review",
      );
      emit("independent-review", "A distinct IRIS reviewer passed the exact candidate commit.");

      delivery = phaseZeroDeliverySchema.parse(
        await this.#adapter.deliver(proposal, candidate, review, boundedSignal),
      );
      assertInvariant(
        delivery.checkpointRef === proposal.checkpointRef &&
          delivery.targetBranch === proposal.targetBranch &&
          delivery.checkpointCommit === delivery.deliveryCommit &&
          delivery.checkpointRemoteRevision === delivery.deliveryCommit &&
          delivery.targetCommit === delivery.deliveryCommit &&
          delivery.targetRemoteRevision === delivery.deliveryCommit &&
          delivery.pullRequest.headCommit === delivery.deliveryCommit,
        "delivery",
      );
      emit(
        "delivery",
        "Private checkpoint and target branch matched before pull-request delivery.",
      );

      merge = phaseZeroMergeSchema.parse(
        await this.#adapter.merge(proposal, delivery, review, boundedSignal),
      );
      assertInvariant(
        merge.pullRequestNumber === delivery.pullRequest.number &&
          merge.expectedHeadCommit === delivery.deliveryCommit &&
          merge.providerMainRevision === merge.mergeCommit,
        "merge",
      );
      emit("merge", "The independently reviewed exact head commit merged without history rewrite.");

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
      );

      rollback = phaseZeroRollbackEvidenceSchema.parse(
        await this.#adapter.preserveRollbackEvidence(proposal, merge, delivery),
      );
      assertInvariant(
        rollback.mergeCommit === merge.mergeCommit &&
          rollback.command === `git revert ${merge.mergeCommit}`,
        "rollback",
      );
      emit("rollback", "History-preserving rollback and private checkpoint recovery were proven.");

      cleanup = phaseZeroCleanupEvidenceSchema.parse(await this.#adapter.cleanup(proposal));
      emit("cleanup", "Execution and delivery workspaces were removed while the journal remained.");

      await this.#adapter.terminatePaidResources(proposal);
      const resources = await this.#adapter.providerResources(proposal);
      assertInvariant(resources.length === 0, "provider-zero");
      emit("provider-zero", "Provider-authoritative inspection reported zero remaining resources.");
      emit("completed", "IRIS completed the exact deployed Phase 0 graduation evidence chain.");
      return result("succeeded", "Phase 0 graduation evidence is complete.", true);
    } catch (error) {
      if (cleanup === undefined) {
        try {
          cleanup = phaseZeroCleanupEvidenceSchema.parse(await this.#adapter.cleanup(proposal));
        } catch {
          // The result remains failed and truthfully omits unverified cleanup evidence.
        }
      }
      try {
        await this.#adapter.terminatePaidResources(proposal);
      } catch {
        // Provider-zero verification below remains authoritative.
      }
      let providerZeroVerified: boolean;
      try {
        providerZeroVerified = (await this.#adapter.providerResources(proposal)).length === 0;
      } catch {
        providerZeroVerified = false;
      }
      const failureStage = error instanceof GraduationInvariantError ? error.stage : stage;
      emit(failureStage, `Phase 0 graduation failed closed during ${failureStage}.`);
      return result(
        "failed",
        `Phase 0 graduation failed closed during ${failureStage}.`,
        providerZeroVerified,
      );
    }
  }
}
