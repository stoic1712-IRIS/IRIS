import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { repositoryRepairResultSchema } from "./repository-repair.js";

const revision = z.string().regex(/^[a-f0-9]{40}$/u);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const safeRef = z.string().regex(/^(?:iris\/delivery|checkpoint\/release-eight)-[a-f0-9]{12}$/u);
const repository = z.enum(["stoic1712-IRIS/IRIS", "stoic1712-IRIS/iris-founder-command-center"]);

export const repositoryDeliveryProposalSchema = z.strictObject({
  proposalId: z.string().regex(/^proposal_release-eight-[a-f0-9]{12}$/u),
  repository,
  baseRevision: revision,
  expectedLocalMainRevision: revision,
  expectedRemoteMainRevision: revision,
  repairResult: repositoryRepairResultSchema,
  repairResultDigest: digest,
  checkpointRepository: z.literal("stoic1712-IRIS/IRIS-checkpoints"),
  checkpointRef: safeRef,
  targetBranch: safeRef,
  commitMessage: z.string().min(1).max(200),
  pullRequestTitle: z.string().min(1).max(200),
  pullRequestBodyDigest: digest,
  pullRequestBody: z.string().min(1).max(8_192),
  pullRequestDraft: z.literal(true),
  maintainersCanModify: z.literal(false),
  maximumRuntimeSeconds: z.literal(900),
  maximumCostUsd: z.literal(0),
  forcePushAuthority: z.literal(false),
  mergeAuthority: z.literal(false),
  deploymentAuthority: z.literal(false),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  digest,
  approvalStatement: z.string().min(1),
});
export type RepositoryDeliveryProposal = z.infer<typeof repositoryDeliveryProposalSchema>;

export const repositoryDeliveryResultSchema = z.strictObject({
  verdict: z.enum([
    "delivered",
    "failed-before-provider-write",
    "failed-after-partial-provider-write",
  ]),
  proposalId: z.string(),
  repository,
  baseRevision: revision,
  deliveryCommit: revision.nullable(),
  checkpointRef: safeRef,
  checkpointEqual: z.boolean(),
  targetBranch: safeRef,
  targetEqual: z.boolean(),
  draftPullRequest: z
    .strictObject({
      number: z.number().int().positive(),
      url: z.url(),
      draft: z.literal(true),
    })
    .nullable(),
  completedSteps: z.array(z.string()).max(20),
  approvalConsumed: z.literal(true),
  canonicalRepositoryChanged: z.literal(false),
  mergePerformed: z.literal(false),
  deploymentPerformed: z.literal(false),
  credentialCleared: z.boolean(),
  cleanupState: z.enum(["completed", "failed"]),
});
export type RepositoryDeliveryResult = z.infer<typeof repositoryDeliveryResultSchema>;

const sha256 = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}` as const;

function assertEligibleRepair(result: z.infer<typeof repositoryRepairResultSchema>): void {
  if (
    result.verdict !== "verified" ||
    result.cleanupState !== "completed" ||
    result.verification.length === 0 ||
    result.verification.some((check) => check.state !== "passed")
  )
    throw new Error("DELIVERY_CANDIDATE_DENIED");
}

export function createRepositoryDeliveryProposal(
  input: {
    repository: z.infer<typeof repository>;
    baseRevision: string;
    expectedLocalMainRevision: string;
    expectedRemoteMainRevision: string;
    repairResult: unknown;
  },
  now = new Date(),
): RepositoryDeliveryProposal {
  const repairResult = repositoryRepairResultSchema.parse(input.repairResult);
  assertEligibleRepair(repairResult);
  if (
    input.repository !== repairResult.repository ||
    input.baseRevision !== repairResult.baseRevision ||
    input.baseRevision !== input.expectedLocalMainRevision ||
    input.baseRevision !== input.expectedRemoteMainRevision
  )
    throw new Error("DELIVERY_BASE_DENIED");
  const repairResultDigest = sha256(JSON.stringify(repairResult));
  const seed = sha256(
    JSON.stringify({
      repository: input.repository,
      baseRevision: input.baseRevision,
      repairResultDigest,
    }),
  );
  const suffix = seed.slice(7, 19);
  const pullRequestBody = [
    "IRIS Release Eight governed delivery",
    `Candidate: ${repairResult.candidateId}`,
    `Diff: ${repairResult.diffDigest}`,
    "State: draft, unmerged, noncanonical",
  ].join("\n");
  const base = {
    ...input,
    repairResult,
    repairResultDigest,
    checkpointRepository: "stoic1712-IRIS/IRIS-checkpoints" as const,
    checkpointRef: `checkpoint/release-eight-${suffix}`,
    targetBranch: `iris/delivery-${suffix}`,
    commitMessage: `delivery: apply verified Release Seven candidate ${suffix}`,
    pullRequestTitle: `Release Eight delivery ${suffix}`,
    pullRequestBodyDigest: sha256(pullRequestBody),
    pullRequestBody,
    pullRequestDraft: true as const,
    maintainersCanModify: false as const,
    maximumRuntimeSeconds: 900 as const,
    maximumCostUsd: 0 as const,
    forcePushAuthority: false as const,
    mergeAuthority: false as const,
    deploymentAuthority: false as const,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 120_000).toISOString(),
  };
  const proposalDigest = sha256(JSON.stringify(base));
  const proposalId = `proposal_release-eight-${proposalDigest.slice(7, 19)}`;
  return repositoryDeliveryProposalSchema.parse({
    ...base,
    proposalId,
    digest: proposalDigest,
    approvalStatement: `I approve repository delivery ${proposalId} at ${proposalDigest} for one checkpoint-first draft pull-request delivery exactly as proposed.`,
  });
}

export function bindRepositoryDeliveryCode(
  secret: string,
  proposal: RepositoryDeliveryProposal,
  code: string,
): string {
  return createHmac("sha256", secret).update(`${proposal.digest}\n${code}`).digest("hex");
}

export function verifyRepositoryDeliveryApproval(input: {
  proposal: RepositoryDeliveryProposal;
  statement: string;
  code: string;
  expectedCodeBinding: string;
  bindingSecret: string;
  now?: Date;
}): boolean {
  const proposal = repositoryDeliveryProposalSchema.parse(input.proposal);
  if (
    input.statement !== proposal.approvalStatement ||
    !/^\d{8}$/u.test(input.code) ||
    (input.now ?? new Date()).getTime() >= Date.parse(proposal.expiresAt) ||
    !/^[a-f0-9]{64}$/u.test(input.expectedCodeBinding)
  )
    return false;
  const actual = bindRepositoryDeliveryCode(input.bindingSecret, proposal, input.code);
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(input.expectedCodeBinding, "hex"));
}

export interface RepositoryDeliveryAdapter {
  preflight(proposal: RepositoryDeliveryProposal): Promise<void>;
  reconstructAndVerify(proposal: RepositoryDeliveryProposal): Promise<string>;
  createCommit(proposal: RepositoryDeliveryProposal): Promise<string>;
  pushCheckpoint(proposal: RepositoryDeliveryProposal, commit: string): Promise<string>;
  pushTarget(proposal: RepositoryDeliveryProposal, commit: string): Promise<string>;
  createDraftPullRequest(
    proposal: RepositoryDeliveryProposal,
    commit: string,
  ): Promise<{ number: number; url: string; draft: true }>;
  cleanup(): Promise<void>;
  clearCredential(): void;
}

export interface RepositoryDeliveryApprovalState {
  consumed: boolean;
}

export async function executeRepositoryDelivery(
  activation: {
    proposal: RepositoryDeliveryProposal;
    statement: string;
    code: string;
    expectedCodeBinding: string;
    bindingSecret: string;
    approvalState: RepositoryDeliveryApprovalState;
    now?: Date;
  },
  adapter: RepositoryDeliveryAdapter,
): Promise<RepositoryDeliveryResult> {
  const proposal = repositoryDeliveryProposalSchema.parse(activation.proposal);
  if (
    activation.approvalState.consumed ||
    !verifyRepositoryDeliveryApproval({
      proposal,
      statement: activation.statement,
      code: activation.code,
      expectedCodeBinding: activation.expectedCodeBinding,
      bindingSecret: activation.bindingSecret,
      ...(activation.now === undefined ? {} : { now: activation.now }),
    })
  )
    throw new Error("DELIVERY_APPROVAL_DENIED");
  activation.approvalState.consumed = true;
  const completedSteps = ["approval-consumed"];
  let deliveryCommit: string | null = null;
  let checkpointEqual = false;
  let targetEqual = false;
  let draftPullRequest: { number: number; url: string; draft: true } | null = null;
  let providerWrite = false;
  let cleanupState: "completed" | "failed" = "completed";
  try {
    await adapter.preflight(proposal);
    completedSteps.push("preflight");
    const candidateDigest = await adapter.reconstructAndVerify(proposal);
    if (candidateDigest !== proposal.repairResult.diffDigest) throw new Error("CANDIDATE_DRIFT");
    completedSteps.push("candidate-reconstructed-and-verified");
    deliveryCommit = await adapter.createCommit(proposal);
    revision.parse(deliveryCommit);
    completedSteps.push("commit-created");
    const checkpointCommit = await adapter.pushCheckpoint(proposal, deliveryCommit);
    providerWrite = true;
    checkpointEqual = checkpointCommit === deliveryCommit;
    if (!checkpointEqual) throw new Error("CHECKPOINT_INEQUALITY");
    completedSteps.push("checkpoint-equal");
    const targetCommit = await adapter.pushTarget(proposal, deliveryCommit);
    targetEqual = targetCommit === deliveryCommit;
    if (!targetEqual) throw new Error("TARGET_INEQUALITY");
    completedSteps.push("target-equal");
    draftPullRequest = await adapter.createDraftPullRequest(proposal, deliveryCommit);
    completedSteps.push("draft-pull-request-equal");
  } catch {
    // The bounded result exposes partial state without retrying or deleting remote evidence.
  } finally {
    adapter.clearCredential();
    try {
      await adapter.cleanup();
      completedSteps.push("cleanup");
    } catch {
      cleanupState = "failed";
    }
  }
  const delivered = checkpointEqual && targetEqual && draftPullRequest !== null;
  return repositoryDeliveryResultSchema.parse({
    verdict: delivered
      ? "delivered"
      : providerWrite
        ? "failed-after-partial-provider-write"
        : "failed-before-provider-write",
    proposalId: proposal.proposalId,
    repository: proposal.repository,
    baseRevision: proposal.baseRevision,
    deliveryCommit,
    checkpointRef: proposal.checkpointRef,
    checkpointEqual,
    targetBranch: proposal.targetBranch,
    targetEqual,
    draftPullRequest,
    completedSteps,
    approvalConsumed: true,
    canonicalRepositoryChanged: false,
    mergePerformed: false,
    deploymentPerformed: false,
    credentialCleared: true,
    cleanupState,
  });
}
