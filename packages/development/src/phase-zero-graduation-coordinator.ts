import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { z } from "zod";

import {
  executableWorkerProposalDigest,
  executableWorkerProposalSchema,
} from "./executable-worker-contracts.js";
import {
  phaseZeroApprovalConsumptionReceiptSchema,
  phaseZeroGraduationApprovalSchema,
  phaseZeroGraduationProposalDigest,
  phaseZeroGraduationProposalSchema,
  phaseZeroMergeApprovalSchema,
  PhaseZeroGraduationRuntime,
  requiredPhaseZeroGraduationApproval,
  requiredPhaseZeroMergeApproval,
  type PhaseZeroApprovalConsumptionReceipt,
  type PhaseZeroCandidate,
  type PhaseZeroCanonicalEquality,
  type PhaseZeroCleanupEvidence,
  type PhaseZeroDelivery,
  type PhaseZeroGraduationAdapter,
  type PhaseZeroGraduationApproval,
  type PhaseZeroGraduationProposal,
  type PhaseZeroGraduationResult,
  type PhaseZeroIndependentReview,
  type PhaseZeroMerge,
  type PhaseZeroMergeApproval,
  type PhaseZeroPreflight,
  type PhaseZeroProviderInspection,
  type PhaseZeroResourceTermination,
  type PhaseZeroRollbackEvidence,
} from "./phase-zero-graduation-readiness.js";
import {
  createIdlePhaseZeroGraduationEnvelope,
  phaseZeroGraduationApprovalEnvelopeSchema,
  phaseZeroGraduationEnvelopeSchema,
  phaseZeroGraduationProposalRequestSchema,
  phaseZeroGraduationResultTransportSchema,
  phaseZeroGraduationTransportVersion,
  type PhaseZeroGraduationProposalRequest,
  type PhaseZeroGraduationTransportStore,
} from "./phase-zero-graduation-transport.js";

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const protectedPath =
  /^(?:\.git|\.github|\.iris)(?:\/|$)|^(?:AGENTS|CLAUDE)\.md$|^docs\/(?:governance|registries)(?:\/|$)|^pnpm-lock\.yaml$/u;
const boundedPathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u)
  .refine(
    (value) =>
      !value.includes("..") &&
      !value.includes("\\") &&
      !value.endsWith("/") &&
      !protectedPath.test(value),
  );
const permittedVerificationCommands = new Set([
  JSON.stringify(["pnpm", "format:check"]),
  JSON.stringify(["pnpm", "lint"]),
  JSON.stringify(["pnpm", "typecheck"]),
  JSON.stringify(["pnpm", "test"]),
  JSON.stringify(["pnpm", "build"]),
  JSON.stringify(["pnpm", "verify"]),
]);

export const phaseZeroGraduationModelPlanSchema = z
  .strictObject({
    objective: z.string().trim().min(10).max(5_000),
    readPaths: z.array(boundedPathSchema).min(2).max(100),
    writePaths: z.array(boundedPathSchema).min(2).max(50),
    verificationCommands: z
      .array(z.array(z.string().min(1).max(500)).min(1).max(30))
      .min(1)
      .max(10),
  })
  .superRefine((plan, context) => {
    if (new Set(plan.readPaths).size !== plan.readPaths.length)
      context.addIssue({ code: "custom", path: ["readPaths"], message: "Duplicate read path." });
    if (new Set(plan.writePaths).size !== plan.writePaths.length)
      context.addIssue({ code: "custom", path: ["writePaths"], message: "Duplicate write path." });
    for (const [index, path] of plan.writePaths.entries())
      if (!plan.readPaths.includes(path))
        context.addIssue({
          code: "custom",
          path: ["writePaths", index],
          message: "Every write path must also be inspected.",
        });
    for (const [index, command] of plan.verificationCommands.entries())
      if (!permittedVerificationCommands.has(JSON.stringify(command)))
        context.addIssue({
          code: "custom",
          path: ["verificationCommands", index],
          message: "Verification command is outside the Core allowlist.",
        });
  });
export type PhaseZeroGraduationModelPlan = z.infer<typeof phaseZeroGraduationModelPlanSchema>;

export interface PhaseZeroGraduationEvidence {
  canonicalBaseRevision: string;
  commandCenterBaseRevision: string;
  deploymentId: string;
  repositoryInspectionDigest: string;
  inspectedAt: string;
  evidence: string;
}

export interface PhaseZeroGraduationEvidenceProvider {
  currentCoreRevision(): Promise<string>;
  inspect(objective: string): Promise<PhaseZeroGraduationEvidence>;
}

export interface PhaseZeroGraduationProposalModel {
  provider: "ollama" | "lm-studio";
  name: string;
  plan(input: {
    objective: string;
    evidence: string;
    repositoryInspectionDigest: string;
    canonicalBaseRevision: string;
  }): Promise<unknown>;
}

export type PhaseZeroGraduationExecutionProvider = Omit<
  PhaseZeroGraduationAdapter,
  "consumeGraduationApproval" | "readMergeApproval" | "consumeMergeApproval"
>;

const recordSchema = z.strictObject({
  version: z.literal(1),
  proposal: phaseZeroGraduationProposalSchema,
  envelope: phaseZeroGraduationEnvelopeSchema,
  graduationApproval: phaseZeroGraduationApprovalSchema.optional(),
  graduationReceipt: phaseZeroApprovalConsumptionReceiptSchema.optional(),
  mergeApproval: phaseZeroMergeApprovalSchema.optional(),
  mergeReceipt: phaseZeroApprovalConsumptionReceiptSchema.optional(),
});
type CoordinatorRecord = z.infer<typeof recordSchema>;

function proposalView(proposal: PhaseZeroGraduationProposal) {
  return {
    graduationId: proposal.graduationId,
    actor: proposal.actor,
    producerId: proposal.producerId,
    canonicalRepository: proposal.canonicalRepository,
    canonicalBaseRevision: proposal.canonicalBaseRevision,
    commandCenterRepository: proposal.commandCenterRepository,
    commandCenterBaseRevision: proposal.commandCenterBaseRevision,
    deploymentId: proposal.deploymentId,
    deployedRuntime: proposal.deployedRuntime,
    modelProvider: proposal.model.provider,
    modelName: proposal.model.name,
    modelEndpoint: proposal.model.endpoint,
    realModel: proposal.model.realModel,
    objective: proposal.executableWorkerProposal.objective,
    readPaths: proposal.executableWorkerProposal.readPaths,
    writePaths: proposal.executableWorkerProposal.writePaths,
    materializationCommands: proposal.executableWorkerProposal.materializationCommands,
    candidateBranch: proposal.candidateBranch,
    checkpointRepository: proposal.checkpointRepository,
    checkpointRef: proposal.checkpointRef,
    targetBranch: proposal.targetBranch,
    verificationCommands: proposal.verificationCommands,
    checkpointFirst: proposal.checkpointFirst,
    independentReviewRequired: proposal.independentReviewRequired,
    mergeRequired: proposal.mergeRequired,
    historyPreservingRollback: proposal.historyPreservingRollback,
    codexMutation: proposal.codexMutation,
    claudeMutation: proposal.claudeMutation,
    fixtureExecution: proposal.fixtureExecution,
    maximumCostUsd: proposal.maximumCostUsd,
    maximumRuntimeMs: proposal.maximumRuntimeMs,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
  };
}

function transportResult(result: PhaseZeroGraduationResult) {
  const transport: Record<string, unknown> = { ...result };
  Reflect.deleteProperty(transport, "candidate");
  return phaseZeroGraduationResultTransportSchema.parse(transport);
}

export class FilePhaseZeroGraduationCoordinator
  implements PhaseZeroGraduationTransportStore, PhaseZeroGraduationAdapter
{
  readonly #statePath: string;
  readonly #now: () => Date;
  readonly #evidence: PhaseZeroGraduationEvidenceProvider;
  readonly #model: PhaseZeroGraduationProposalModel;
  readonly #execution: PhaseZeroGraduationExecutionProvider;
  readonly #onActivationError: (error: unknown) => void;
  #active: CoordinatorRecord | null = null;
  #activationStarted = false;

  constructor(options: {
    statePath: string;
    now?: () => Date;
    evidence: PhaseZeroGraduationEvidenceProvider;
    model: PhaseZeroGraduationProposalModel;
    execution: PhaseZeroGraduationExecutionProvider;
    onActivationError?: (error: unknown) => void;
  }) {
    if (options.statePath.trim() === "") throw new Error("PHASE_ZERO_STATE_PATH_REQUIRED");
    this.#statePath = options.statePath;
    this.#now = options.now ?? (() => new Date());
    this.#evidence = options.evidence;
    this.#model = options.model;
    this.#execution = options.execution;
    this.#onActivationError = options.onActivationError ?? (() => undefined);
  }

  activeProposal(): PhaseZeroGraduationProposal | null {
    return this.#active === null ? null : structuredClone(this.#active.proposal);
  }

  async read(): Promise<unknown> {
    const record = await this.#load();
    if (record === null)
      return createIdlePhaseZeroGraduationEnvelope(
        revisionSchema.parse(await this.#evidence.currentCoreRevision()),
        this.#now(),
      );
    const refreshed = {
      ...record.envelope,
      coreRevision: revisionSchema.parse(await this.#evidence.currentCoreRevision()),
      generatedAt: this.#now().toISOString(),
      expiresAt: new Date(this.#now().getTime() + 30_000).toISOString(),
    };
    record.envelope = phaseZeroGraduationEnvelopeSchema.parse(refreshed);
    this.#active = record;
    if (
      record.graduationApproval !== undefined &&
      record.graduationReceipt !== undefined &&
      record.envelope.state !== "concluded"
    )
      this.#startActivation(record.proposal, record.graduationApproval);
    return record.envelope;
  }

  async prepareProposal(input: PhaseZeroGraduationProposalRequest): Promise<unknown> {
    const request = phaseZeroGraduationProposalRequestSchema.parse(input);
    const existing = await this.#load();
    if (existing !== null) {
      if (
        existing.graduationReceipt === undefined &&
        this.#now().getTime() >= Date.parse(existing.proposal.expiresAt)
      ) {
        await rm(this.#statePath, { force: true });
        this.#active = null;
      } else throw new Error("PHASE_ZERO_WORKFLOW_ALREADY_EXISTS");
    }
    const evidence = z
      .strictObject({
        canonicalBaseRevision: revisionSchema,
        commandCenterBaseRevision: revisionSchema,
        deploymentId: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,127}$/u),
        repositoryInspectionDigest: digestSchema,
        inspectedAt: z.iso.datetime(),
        evidence: z.string().min(1).max(512_000),
      })
      .parse(await this.#evidence.inspect(request.objective));
    if (Date.parse(evidence.inspectedAt) > this.#now().getTime())
      throw new Error("PHASE_ZERO_EVIDENCE_FROM_FUTURE");
    const plan = phaseZeroGraduationModelPlanSchema.parse(
      await this.#model.plan({
        objective: request.objective,
        evidence: evidence.evidence,
        repositoryInspectionDigest: evidence.repositoryInspectionDigest,
        canonicalBaseRevision: evidence.canonicalBaseRevision,
      }),
    );
    const createdAt = this.#now();
    const seed = createHash("sha256")
      .update(
        JSON.stringify({
          request,
          plan,
          canonicalBaseRevision: evidence.canonicalBaseRevision,
          commandCenterBaseRevision: evidence.commandCenterBaseRevision,
          repositoryInspectionDigest: evidence.repositoryInspectionDigest,
          createdAt: createdAt.toISOString(),
        }),
      )
      .digest("hex")
      .slice(0, 12);
    const expiresAt = new Date(createdAt.getTime() + 60 * 60_000).toISOString();
    const executionId = `execution_cycle8-phase0-${seed}`;
    const candidateBranch = `iris/candidate/phase-zero-${seed}`;
    const executableWorkerProposal = executableWorkerProposalSchema.parse({
      executionId,
      objective: plan.objective,
      repository: "stoic1712-IRIS/IRIS",
      baseRevision: evidence.canonicalBaseRevision,
      branch: candidateBranch,
      readPaths: plan.readPaths,
      writePaths: plan.writePaths,
      forbiddenPaths: [
        ".git",
        ".github",
        ".iris",
        "AGENTS.md",
        "CLAUDE.md",
        "docs/governance",
        "docs/registries",
        "pnpm-lock.yaml",
      ],
      materializationCommands: [
        ["pnpm", "install", "--offline", "--frozen-lockfile", "--ignore-scripts"],
      ],
      baselineCommands: plan.verificationCommands,
      normalizationCommands: [],
      commands: plan.verificationCommands,
      maximumIterations: 3,
      maximumChangedFiles: Math.min(50, Math.max(plan.writePaths.length, 2)),
      maximumChangedBytes: 1_000_000,
      timeoutMs: 900_000,
      expiresAt,
      budgetUsd: 0,
      canonicalWrite: false,
      externalMutation: false,
      mayExpand: false,
      createdAt: createdAt.toISOString(),
    });
    const proposal = phaseZeroGraduationProposalSchema.parse({
      graduationId: `graduation_phase0-${seed}`,
      actor: "IRIS",
      producerId: "iris-development-worker",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      canonicalBaseRevision: evidence.canonicalBaseRevision,
      commandCenterRepository: "stoic1712-IRIS/iris-founder-command-center",
      commandCenterBaseRevision: evidence.commandCenterBaseRevision,
      deploymentId: evidence.deploymentId,
      deployedRuntime: true,
      model: {
        provider: this.#model.provider,
        name: this.#model.name,
        endpoint: "loopback",
        realModel: true,
        repositoryInspectionRevision: evidence.canonicalBaseRevision,
        repositoryInspectionDigest: evidence.repositoryInspectionDigest,
        inspectedAt: evidence.inspectedAt,
      },
      executableWorkerProposalDigest: executableWorkerProposalDigest(executableWorkerProposal),
      executableWorkerExecutionId: executionId,
      executableWorkerProposal,
      candidateBranch,
      checkpointRepository: "stoic1712-IRIS/IRIS-checkpoints",
      checkpointRef: `checkpoint/phase-zero-${seed}`,
      targetBranch: `iris/phase-zero-graduation-${seed}`,
      verificationCommands: plan.verificationCommands,
      checkpointFirst: true,
      independentReviewRequired: true,
      mergeRequired: true,
      historyPreservingRollback: true,
      codexMutation: false,
      claudeMutation: false,
      fixtureExecution: false,
      maximumCostUsd: 0,
      maximumRuntimeMs: 3_600_000,
      createdAt: createdAt.toISOString(),
      expiresAt,
    });
    const proposalDigest = phaseZeroGraduationProposalDigest(proposal);
    const envelope = phaseZeroGraduationEnvelopeSchema.parse({
      apiVersion: phaseZeroGraduationTransportVersion,
      state: "presented",
      coreRevision: evidence.canonicalBaseRevision,
      generatedAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 30_000).toISOString(),
      proposal: proposalView(proposal),
      proposalDigest,
      approvalStatement: requiredPhaseZeroGraduationApproval(proposal),
      graduationApprovalConsumed: false,
      mergeApprovalStatement: null,
      mergeApprovalConsumed: false,
      mergeContext: null,
    });
    const record = recordSchema.parse({ version: 1, proposal, envelope });
    await this.#save(record);
    this.#active = record;
    return envelope;
  }

  async consumeApproval(input: z.infer<typeof phaseZeroGraduationApprovalEnvelopeSchema>) {
    const submitted = phaseZeroGraduationApprovalEnvelopeSchema.parse(input);
    const record = await this.#requireRecord();
    const proposalDigest = phaseZeroGraduationProposalDigest(record.proposal);
    const currentTime = this.#now().getTime();
    if (
      submitted.approval.graduationId !== record.proposal.graduationId ||
      submitted.approval.proposalDigest !== proposalDigest ||
      currentTime >= Date.parse(record.proposal.expiresAt) ||
      Date.parse(submitted.approval.issuedAt) > currentTime ||
      Date.parse(submitted.approval.issuedAt) >= Date.parse(record.proposal.expiresAt)
    )
      throw new Error("PHASE_ZERO_APPROVAL_MISMATCH");
    if (submitted.approvalType === "graduation") {
      const approval = phaseZeroGraduationApprovalSchema.parse(submitted.approval);
      if (
        record.graduationReceipt !== undefined ||
        approval.typedStatement !== requiredPhaseZeroGraduationApproval(record.proposal)
      )
        throw new Error("PHASE_ZERO_GRADUATION_APPROVAL_REPLAY_OR_MISMATCH");
      const receipt = phaseZeroApprovalConsumptionReceiptSchema.parse({
        approvalId: approval.approvalId,
        graduationId: approval.graduationId,
        proposalDigest,
        approvalType: "graduation",
        consumedBy: "IRIS",
        durableLedger: true,
        consumedAt: this.#now().toISOString(),
      });
      record.graduationApproval = approval;
      record.graduationReceipt = receipt;
      record.envelope = phaseZeroGraduationEnvelopeSchema.parse({
        ...record.envelope,
        graduationApprovalConsumed: true,
        generatedAt: this.#now().toISOString(),
        expiresAt: new Date(this.#now().getTime() + 30_000).toISOString(),
      });
      await this.#save(record);
      this.#active = record;
      this.#startActivation(record.proposal, approval);
      return receipt;
    }
    const approval = phaseZeroMergeApprovalSchema.parse(submitted.approval);
    if (
      record.graduationReceipt === undefined ||
      record.mergeReceipt !== undefined ||
      record.envelope.state === "idle" ||
      record.envelope.mergeContext === null ||
      record.envelope.mergeApprovalStatement === null ||
      approval.typedStatement !== record.envelope.mergeApprovalStatement
    )
      throw new Error("PHASE_ZERO_MERGE_APPROVAL_REPLAY_OR_MISMATCH");
    const receipt = phaseZeroApprovalConsumptionReceiptSchema.parse({
      approvalId: approval.approvalId,
      graduationId: approval.graduationId,
      proposalDigest,
      approvalType: "merge",
      consumedBy: "IRIS",
      durableLedger: true,
      consumedAt: this.#now().toISOString(),
    });
    record.mergeApproval = approval;
    record.mergeReceipt = receipt;
    record.envelope = phaseZeroGraduationEnvelopeSchema.parse({
      ...record.envelope,
      mergeApprovalConsumed: true,
      generatedAt: this.#now().toISOString(),
      expiresAt: new Date(this.#now().getTime() + 30_000).toISOString(),
    });
    await this.#save(record);
    this.#active = record;
    return receipt;
  }

  async consumeGraduationApproval(
    proposal: PhaseZeroGraduationProposal,
    approval: PhaseZeroGraduationApproval,
  ): Promise<PhaseZeroApprovalConsumptionReceipt> {
    const record = await this.#requireRecord();
    if (
      phaseZeroGraduationProposalDigest(proposal) !==
        phaseZeroGraduationProposalDigest(record.proposal) ||
      record.graduationApproval?.approvalId !== approval.approvalId ||
      record.graduationReceipt === undefined
    )
      throw new Error("PHASE_ZERO_GRADUATION_RECEIPT_UNAVAILABLE");
    return record.graduationReceipt;
  }

  preflight(
    proposal: PhaseZeroGraduationProposal,
    signal: AbortSignal,
  ): Promise<PhaseZeroPreflight> {
    return this.#execution.preflight(proposal, signal);
  }
  executeCandidate(
    proposal: PhaseZeroGraduationProposal,
    signal: AbortSignal,
  ): Promise<PhaseZeroCandidate> {
    return this.#execution.executeCandidate(proposal, signal);
  }
  independentlyReview(
    proposal: PhaseZeroGraduationProposal,
    candidate: PhaseZeroCandidate,
    signal: AbortSignal,
  ): Promise<PhaseZeroIndependentReview> {
    return this.#execution.independentlyReview(proposal, candidate, signal);
  }
  deliver(
    proposal: PhaseZeroGraduationProposal,
    candidate: PhaseZeroCandidate,
    review: PhaseZeroIndependentReview,
    signal: AbortSignal,
  ): Promise<PhaseZeroDelivery> {
    return this.#execution.deliver(proposal, candidate, review, signal);
  }

  async readMergeApproval(
    proposal: PhaseZeroGraduationProposal,
    delivery: PhaseZeroDelivery,
    review: PhaseZeroIndependentReview,
    signal: AbortSignal,
  ): Promise<PhaseZeroMergeApproval> {
    const record = await this.#requireRecord();
    const statement = requiredPhaseZeroMergeApproval(proposal, delivery, review);
    record.envelope = phaseZeroGraduationEnvelopeSchema.parse({
      ...record.envelope,
      mergeApprovalStatement: statement,
      mergeApprovalConsumed: false,
      mergeContext: {
        deliveryCommit: delivery.deliveryCommit,
        reviewedCommit: review.reviewedCommit,
        pullRequestNumber: delivery.pullRequest.number,
      },
      generatedAt: this.#now().toISOString(),
      expiresAt: new Date(this.#now().getTime() + 30_000).toISOString(),
    });
    await this.#save(record);
    while (!signal.aborted && this.#now().getTime() < Date.parse(proposal.expiresAt)) {
      const current = await this.#requireRecord();
      if (current.mergeApproval !== undefined) return current.mergeApproval;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    throw new Error("PHASE_ZERO_MERGE_APPROVAL_UNAVAILABLE");
  }

  async consumeMergeApproval(
    proposal: PhaseZeroGraduationProposal,
    approval: PhaseZeroMergeApproval,
  ): Promise<PhaseZeroApprovalConsumptionReceipt> {
    const record = await this.#requireRecord();
    if (
      phaseZeroGraduationProposalDigest(proposal) !==
        phaseZeroGraduationProposalDigest(record.proposal) ||
      record.mergeApproval?.approvalId !== approval.approvalId ||
      record.mergeReceipt === undefined
    )
      throw new Error("PHASE_ZERO_MERGE_RECEIPT_UNAVAILABLE");
    return record.mergeReceipt;
  }

  merge(
    proposal: PhaseZeroGraduationProposal,
    delivery: PhaseZeroDelivery,
    review: PhaseZeroIndependentReview,
    mergeReceipt: PhaseZeroApprovalConsumptionReceipt,
    signal: AbortSignal,
  ): Promise<PhaseZeroMerge> {
    return this.#execution.merge(proposal, delivery, review, mergeReceipt, signal);
  }
  verifyCanonicalEquality(
    proposal: PhaseZeroGraduationProposal,
    merge: PhaseZeroMerge,
  ): Promise<PhaseZeroCanonicalEquality> {
    return this.#execution.verifyCanonicalEquality(proposal, merge);
  }
  preserveRollbackEvidence(
    proposal: PhaseZeroGraduationProposal,
    merge: PhaseZeroMerge,
    delivery: PhaseZeroDelivery,
  ): Promise<PhaseZeroRollbackEvidence> {
    return this.#execution.preserveRollbackEvidence(proposal, merge, delivery);
  }
  cleanup(proposal: PhaseZeroGraduationProposal): Promise<PhaseZeroCleanupEvidence> {
    return this.#execution.cleanup(proposal);
  }
  terminatePaidResources(
    proposal: PhaseZeroGraduationProposal,
  ): Promise<PhaseZeroResourceTermination> {
    return this.#execution.terminatePaidResources(proposal);
  }
  providerResources(proposal: PhaseZeroGraduationProposal): Promise<PhaseZeroProviderInspection> {
    return this.#execution.providerResources(proposal);
  }

  #startActivation(
    proposal: PhaseZeroGraduationProposal,
    approval: PhaseZeroGraduationApproval,
  ): void {
    if (this.#activationStarted) return;
    this.#activationStarted = true;
    queueMicrotask(() => {
      void new PhaseZeroGraduationRuntime({ adapter: this, now: this.#now })
        .execute(proposal, approval)
        .then((result) => this.#conclude(result))
        .catch((error: unknown) => {
          this.#onActivationError(error);
        });
    });
  }

  async #conclude(result: PhaseZeroGraduationResult): Promise<void> {
    const record = await this.#requireRecord();
    record.envelope = phaseZeroGraduationEnvelopeSchema.parse({
      ...record.envelope,
      state: "concluded",
      result: transportResult(result),
      graduationApprovalConsumed: result.approvalConsumed,
      mergeApprovalConsumed: result.mergeApprovalConsumed,
      generatedAt: this.#now().toISOString(),
      expiresAt: new Date(this.#now().getTime() + 30_000).toISOString(),
    });
    await this.#save(record);
    this.#active = record;
  }

  async #load(): Promise<CoordinatorRecord | null> {
    if (this.#active !== null) return structuredClone(this.#active);
    try {
      const record = recordSchema.parse(JSON.parse(await readFile(this.#statePath, "utf8")));
      this.#active = record;
      return structuredClone(record);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async #requireRecord(): Promise<CoordinatorRecord> {
    const record = await this.#load();
    if (record === null) throw new Error("PHASE_ZERO_WORKFLOW_NOT_FOUND");
    return record;
  }

  async #save(recordInput: CoordinatorRecord): Promise<void> {
    const record = recordSchema.parse(recordInput);
    await mkdir(dirname(this.#statePath), { recursive: true });
    const temporary = `${this.#statePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(record)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporary, this.#statePath);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
    this.#active = structuredClone(record);
  }
}
