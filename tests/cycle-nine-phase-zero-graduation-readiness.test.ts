import { describe, expect, it } from "vitest";

import {
  PhaseZeroGraduationRuntime,
  executableWorkerProposalDigest,
  getSovereignDevelopmentSelfDescription,
  phaseZeroGraduationProposalDigest,
  phaseZeroGraduationProposalSchema,
  requiredPhaseZeroGraduationApproval,
  requiredPhaseZeroMergeApproval,
  verifyPhaseZeroGraduationEventChain,
  type PhaseZeroApprovalConsumptionReceipt,
  type PhaseZeroCandidate,
  type PhaseZeroCleanupEvidence,
  type PhaseZeroDelivery,
  type PhaseZeroGraduationAdapter,
  type PhaseZeroGraduationApproval,
  type PhaseZeroGraduationProposal,
  type PhaseZeroIndependentReview,
  type PhaseZeroMerge,
  type PhaseZeroMergeApproval,
  type PhaseZeroPreflight,
  type PhaseZeroProviderInspection,
  type PhaseZeroResourceTermination,
} from "../packages/development/src/index.js";

const baseRevision = "a".repeat(40);
const commandCenterRevision = "b".repeat(40);
const candidateCommit = "c".repeat(40);
const deliveryCommit = candidateCommit;
const mergeCommit = "e".repeat(40);
const baseTreeDigest = `sha256:${"1".repeat(64)}`;
const candidateTreeDigest = `sha256:${"2".repeat(64)}`;
const candidateDiffDigest = `sha256:${"3".repeat(64)}`;
const createdAt = "2026-08-06T12:00:00.000Z";

function executableProposal() {
  return {
    executionId: "execution_cycle8-phase0-final-0001",
    objective: "Perform the exact governed multi-file IRIS self-upgrade.",
    repository: "stoic1712-IRIS/IRIS",
    baseRevision,
    branch: "iris/candidate/phase0-final-0001",
    readPaths: ["packages/development/src/example.ts", "tests/example.test.ts"],
    writePaths: ["packages/development/src/example.ts", "tests/example.test.ts"],
    forbiddenPaths: [".git", ".github", ".iris", "docs/governance"],
    materializationCommands: [],
    commands: [["pnpm", "verify"]],
    maximumIterations: 2,
    maximumChangedFiles: 2,
    maximumChangedBytes: 100_000,
    timeoutMs: 240_000,
    expiresAt: "2026-08-06T12:50:00.000Z",
    budgetUsd: 0 as const,
    canonicalWrite: false as const,
    externalMutation: false as const,
    mayExpand: false as const,
    createdAt,
  };
}

function proposal(
  overrides: Partial<PhaseZeroGraduationProposal> = {},
): PhaseZeroGraduationProposal {
  const executableWorkerProposal = {
    ...executableProposal(),
    ...(overrides.expiresAt === undefined ? {} : { expiresAt: overrides.expiresAt }),
  };
  return phaseZeroGraduationProposalSchema.parse({
    graduationId: "graduation_phase0-readiness-0001",
    actor: "IRIS",
    producerId: "iris-development-worker",
    canonicalRepository: "stoic1712-IRIS/IRIS",
    canonicalBaseRevision: baseRevision,
    commandCenterRepository: "stoic1712-IRIS/iris-founder-command-center",
    commandCenterBaseRevision: commandCenterRevision,
    deploymentId: "deployment_phase0-local",
    deployedRuntime: true,
    model: {
      provider: "ollama",
      name: "qwen3-coder:30b",
      endpoint: "loopback",
      realModel: true,
      repositoryInspectionRevision: baseRevision,
      repositoryInspectionDigest: `sha256:${"7".repeat(64)}`,
      inspectedAt: "2026-08-06T11:59:50.000Z",
    },
    executableWorkerProposalDigest: executableWorkerProposalDigest(executableWorkerProposal),
    executableWorkerExecutionId: "execution_cycle8-phase0-final-0001",
    executableWorkerProposal,
    candidateBranch: "iris/candidate/phase0-final-0001",
    checkpointRepository: "stoic1712-IRIS/IRIS-checkpoints",
    checkpointRef: "checkpoint/phase-zero-aaaaaaaaaaaa",
    targetBranch: "iris/phase-zero-graduation-aaaaaaaaaaaa",
    verificationCommands: [["pnpm", "verify"]],
    checkpointFirst: true,
    independentReviewRequired: true,
    mergeRequired: true,
    historyPreservingRollback: true,
    codexMutation: false,
    claudeMutation: false,
    fixtureExecution: false,
    maximumCostUsd: 0,
    maximumRuntimeMs: 300_000,
    createdAt,
    expiresAt: "2026-08-06T13:00:00.000Z",
    ...overrides,
  });
}

function approval(current = proposal()): PhaseZeroGraduationApproval {
  return {
    approvalId: "approval_phase0-readiness-0001",
    graduationId: current.graduationId,
    proposalDigest: phaseZeroGraduationProposalDigest(current),
    approvedBy: "Founder",
    authentication: {
      actorId: "Founder",
      sessionId: "founder-session-0001",
      assurance: "founder-loopback-session",
      verified: true,
      evidenceDigest: `sha256:${"8".repeat(64)}`,
      authenticatedAt: "2026-08-06T12:00:30.000Z",
    },
    typedStatement: requiredPhaseZeroGraduationApproval(current),
    oneTime: true,
    issuedAt: "2026-08-06T12:01:00.000Z",
  };
}

class ContractAdapter implements PhaseZeroGraduationAdapter {
  readonly events: string[] = [];
  readonly consumedApprovalIds = new Set<string>();
  failAt: string | undefined;
  providerResourceState: string[] = [];
  reviewerId = "iris-independent-review-worker";
  candidateCommitValue = candidateCommit;
  candidateBaseRevision = baseRevision;
  candidateBaseTreeDigest = baseTreeDigest;
  candidateTreeDigest = candidateTreeDigest;
  candidateDiffDigest = candidateDiffDigest;
  candidateBaseAncestorVerified = true;
  candidateDiffVerified = true;
  modelObservedAt = "2026-08-06T12:05:00.000Z";
  reviewCommit = candidateCommit;
  reviewBaseRevision = baseRevision;
  reviewTreeDigest = candidateTreeDigest;
  reviewDiffDigest = candidateDiffDigest;
  candidateChangedPaths = ["packages/development/src/example.ts", "tests/example.test.ts"];
  deliveredCommit = deliveryCommit;
  checkpointRemoteRevision = deliveryCommit;
  pullRequestHead = deliveryCommit;
  pullRequestUrl = "https://github.com/stoic1712-IRIS/IRIS/pull/90";
  mergeExpectedHead = deliveryCommit;
  mergeFirstParent = baseRevision;
  mergeSecondParent = deliveryCommit;
  canonicalRemoteRevision = mergeCommit;
  providerMainRevision = baseRevision;
  preflightLocalRevision = baseRevision;
  preflightRemoteRevision = baseRevision;
  preflightProviderRevision = baseRevision;
  preflightCommandCenterRevision = commandCenterRevision;
  mergeMutatesThenThrows = false;
  rollbackCommand = `git revert -m 1 ${mergeCommit}`;
  cleanupVerified = true;
  providerInspectionFails = false;
  graduationApprovalMutatesThenThrows = false;
  mergeApprovalMutatesThenThrows = false;
  resourceVerifiedAt = "2026-08-06T12:20:00.000Z";
  providerVerifiedAt = "2026-08-06T12:21:00.000Z";

  #record(name: string): void {
    this.events.push(name);
    if (this.failAt === name) throw new Error(`CONTRACT_FAILURE:${name}`);
  }

  consumeGraduationApproval(
    current: PhaseZeroGraduationProposal,
    currentApproval: PhaseZeroGraduationApproval,
  ): Promise<PhaseZeroApprovalConsumptionReceipt> {
    this.#record("consume-graduation-approval");
    if (this.consumedApprovalIds.has(currentApproval.approvalId))
      return Promise.reject(new Error("APPROVAL_REPLAY"));
    this.consumedApprovalIds.add(currentApproval.approvalId);
    if (this.graduationApprovalMutatesThenThrows)
      return Promise.reject(new Error("GRADUATION_APPROVAL_CONSUMED_THEN_FAILED"));
    return Promise.resolve({
      approvalId: currentApproval.approvalId,
      graduationId: current.graduationId,
      proposalDigest: phaseZeroGraduationProposalDigest(current),
      approvalType: "graduation",
      consumedBy: "IRIS",
      durableLedger: true,
      consumedAt: "2026-08-06T12:02:00.000Z",
    });
  }

  preflight(): Promise<PhaseZeroPreflight> {
    this.#record("preflight");
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      commandCenterRepository: "stoic1712-IRIS/iris-founder-command-center",
      checkpointRepository: "stoic1712-IRIS/IRIS-checkpoints",
      deployedRuntime: true,
      deploymentId: "deployment_phase0-local",
      canonicalLocalRevision: this.preflightLocalRevision,
      canonicalRemoteRevision: this.preflightRemoteRevision,
      providerMainRevision: this.preflightProviderRevision,
      commandCenterRevision: this.preflightCommandCenterRevision,
      commandCenterConnected: true,
      modelProvider: "ollama",
      modelName: "qwen3-coder:30b",
      modelReady: true,
      checkpointRepositoryPrivate: true,
      ephemeralCredentialReady: true,
      codexMutationObserved: false,
      claudeMutationObserved: false,
      currentProviderResources: [],
    });
  }

  executeCandidate(): Promise<PhaseZeroCandidate> {
    this.#record("candidate");
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      executionId: "execution_cycle8-phase0-final-0001",
      executableWorkerProposalDigest: executableWorkerProposalDigest(executableProposal()),
      producerId: "iris-development-worker",
      status: "succeeded",
      baseRevision: this.candidateBaseRevision,
      candidateCommit: this.candidateCommitValue,
      baseTreeDigest: this.candidateBaseTreeDigest,
      candidateTreeDigest: this.candidateTreeDigest,
      candidateDiffDigest: this.candidateDiffDigest,
      baseAncestorVerified: this
        .candidateBaseAncestorVerified as PhaseZeroCandidate["baseAncestorVerified"],
      diffVerified: this.candidateDiffVerified as PhaseZeroCandidate["diffVerified"],
      candidateRef: "refs/heads/iris/candidate/phase0-final-0001",
      changedPaths: this.candidateChangedPaths,
      verificationCommands: [["pnpm", "verify"]],
      checksPassed: true,
      workerApprovalConsumed: true,
      eventChainVerified: true,
      workspaceCleanupVerified: true,
      protectedPathsUntouched: true,
      codexMutationObserved: false,
      claudeMutationObserved: false,
      realModelObserved: true,
      modelProvider: "ollama",
      modelName: "qwen3-coder:30b",
      modelEndpoint: "loopback",
      repositoryInspectionDigest: `sha256:${"7".repeat(64)}`,
      modelResponseDigest: `sha256:${"9".repeat(64)}`,
      modelObservedAt: this.modelObservedAt,
    });
  }

  independentlyReview(): Promise<PhaseZeroIndependentReview> {
    this.#record("independent-review");
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      reviewerId: this.reviewerId as PhaseZeroIndependentReview["reviewerId"],
      baseRevision: this.reviewBaseRevision,
      reviewedCommit: this.reviewCommit,
      candidateTreeDigest: this.reviewTreeDigest,
      candidateDiffDigest: this.reviewDiffDigest,
      baseAncestorVerified: true,
      diffVerified: true,
      verdict: "pass",
      findings: [],
      verificationCommands: [["pnpm", "verify"]],
      checksPassed: true,
      canonicalRepositoryChanged: false,
      codexMutationObserved: false,
      claudeMutationObserved: false,
    });
  }

  deliver(): Promise<PhaseZeroDelivery> {
    this.#record("delivery");
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      checkpointRepository: "stoic1712-IRIS/IRIS-checkpoints",
      deliveryCommit: this.deliveredCommit,
      checkpointRef: "checkpoint/phase-zero-aaaaaaaaaaaa",
      checkpointCommit: this.deliveredCommit,
      checkpointRemoteRevision: this.checkpointRemoteRevision,
      checkpointCreatedFirst: true,
      checkpointCreatedAt: "2026-08-06T12:10:00.000Z",
      targetBranch: "iris/phase-zero-graduation-aaaaaaaaaaaa",
      targetCommit: this.deliveredCommit,
      targetRemoteRevision: this.deliveredCommit,
      targetPushedAt: "2026-08-06T12:11:00.000Z",
      pullRequest: {
        repository: "stoic1712-IRIS/IRIS",
        number: 90,
        url: this.pullRequestUrl,
        headCommit: this.pullRequestHead,
        draft: true,
      },
      credentialCleared: true,
      workspaceCleanupVerified: true,
      codexMutationObserved: false,
      claudeMutationObserved: false,
    });
  }

  readMergeApproval(
    current: PhaseZeroGraduationProposal,
    currentDelivery: PhaseZeroDelivery,
    currentReview: PhaseZeroIndependentReview,
  ): Promise<PhaseZeroMergeApproval> {
    this.#record("read-merge-approval");
    return Promise.resolve({
      approvalId: "approval_phase0-merge-readiness-0001",
      graduationId: current.graduationId,
      proposalDigest: phaseZeroGraduationProposalDigest(current),
      deliveryCommit: currentDelivery.deliveryCommit,
      reviewedCommit: currentReview.reviewedCommit,
      pullRequestNumber: currentDelivery.pullRequest.number,
      approvedBy: "Founder",
      authentication: {
        actorId: "Founder",
        sessionId: "founder-session-merge-0001",
        assurance: "founder-loopback-session",
        verified: true,
        evidenceDigest: `sha256:${"6".repeat(64)}`,
        authenticatedAt: "2026-08-06T12:11:30.000Z",
      },
      typedStatement: requiredPhaseZeroMergeApproval(current, currentDelivery, currentReview),
      oneTime: true,
      issuedAt: "2026-08-06T12:12:00.000Z",
    });
  }

  consumeMergeApproval(
    current: PhaseZeroGraduationProposal,
    currentApproval: PhaseZeroMergeApproval,
  ): Promise<PhaseZeroApprovalConsumptionReceipt> {
    this.#record("consume-merge-approval");
    if (this.consumedApprovalIds.has(currentApproval.approvalId))
      return Promise.reject(new Error("APPROVAL_REPLAY"));
    this.consumedApprovalIds.add(currentApproval.approvalId);
    if (this.mergeApprovalMutatesThenThrows)
      return Promise.reject(new Error("MERGE_APPROVAL_CONSUMED_THEN_FAILED"));
    return Promise.resolve({
      approvalId: currentApproval.approvalId,
      graduationId: current.graduationId,
      proposalDigest: phaseZeroGraduationProposalDigest(current),
      approvalType: "merge",
      consumedBy: "IRIS",
      durableLedger: true,
      consumedAt: "2026-08-06T12:12:01.000Z",
    });
  }

  merge(
    current: PhaseZeroGraduationProposal,
    _delivery: PhaseZeroDelivery,
    _review: PhaseZeroIndependentReview,
    mergeApprovalReceipt: PhaseZeroApprovalConsumptionReceipt,
  ): Promise<PhaseZeroMerge> {
    this.#record("merge");
    this.providerMainRevision = mergeCommit;
    if (this.mergeMutatesThenThrows)
      return Promise.reject(new Error("PROVIDER_MUTATED_THEN_FAILED"));
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      providerActor: "stoic1712-IRIS",
      providerActorVerified: true,
      pullRequestNumber: 90,
      expectedHeadCommit: this.mergeExpectedHead,
      mergeCommit,
      firstParentRevision: this.mergeFirstParent,
      secondParentRevision: this.mergeSecondParent,
      providerMainRevision: mergeCommit,
      mergeMethod: "merge-commit",
      independentReviewConsumed: true,
      mergeApprovalId: mergeApprovalReceipt.approvalId,
      mergeApprovalProposalDigest: phaseZeroGraduationProposalDigest(current),
      codexMutationObserved: false,
      claudeMutationObserved: false,
    });
  }

  verifyCanonicalEquality() {
    this.#record("canonical-equality");
    return Promise.resolve({
      actor: "IRIS" as const,
      canonicalRepository: "stoic1712-IRIS/IRIS" as const,
      localMainRevision: mergeCommit,
      remoteMainRevision: this.canonicalRemoteRevision,
      providerMainRevision: mergeCommit,
    });
  }

  preserveRollbackEvidence() {
    this.#record("rollback");
    return Promise.resolve({
      actor: "IRIS" as const,
      canonicalRepository: "stoic1712-IRIS/IRIS" as const,
      mergeCommit,
      strategy: "revert" as const,
      command: this.rollbackCommand,
      mergeCommitIsAncestor: true as const,
      privateCheckpointRecoverable: true as const,
      preservesHistory: true as const,
    });
  }

  cleanup(): Promise<PhaseZeroCleanupEvidence> {
    this.#record("cleanup");
    if (!this.cleanupVerified) return Promise.reject(new Error("CLEANUP_UNVERIFIED"));
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      executionWorkspaceRemoved: true,
      deliveryWorkspaceRemoved: true,
      journalPreserved: true,
      credentialCleared: true,
    });
  }

  terminatePaidResources(): Promise<PhaseZeroResourceTermination> {
    this.#record("terminate-paid-resources");
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      observedCostUsd: 0,
      terminatedResourceIds: [],
      paidResourcesTerminated: true,
      verifiedAt: this.resourceVerifiedAt,
    });
  }

  providerResources(): Promise<PhaseZeroProviderInspection> {
    this.#record("provider-zero");
    if (this.providerInspectionFails)
      return Promise.reject(new Error("PROVIDER_INSPECTION_FAILED"));
    return Promise.resolve({
      actor: "IRIS",
      canonicalRepository: "stoic1712-IRIS/IRIS",
      provider: "github",
      account: "stoic1712-IRIS",
      scope: [
        "stoic1712-IRIS/IRIS",
        "stoic1712-IRIS/iris-founder-command-center",
        "stoic1712-IRIS/IRIS-checkpoints",
      ] as const,
      providerAuthoritative: true,
      providerMainRevision: this.providerMainRevision,
      resources: this.providerResourceState,
      verifiedAt: this.providerVerifiedAt,
    });
  }
}

function runtime(adapter: PhaseZeroGraduationAdapter) {
  return new PhaseZeroGraduationRuntime({
    adapter,
    now: () => new Date("2026-08-06T12:30:00.000Z"),
  });
}

describe("Cycle Nine Phase 0 graduation-readiness controller", () => {
  it("binds the complete IRIS-owned chain and every evidence object", async () => {
    const adapter = new ContractAdapter();
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current));

    expect(result).toMatchObject({
      status: "succeeded",
      stage: "completed",
      approvalConsumed: true,
      mergeApprovalConsumed: true,
      canonicalRepositoryChanged: true,
      canonicalRepositoryChangeVerified: true,
      phase0GraduationEvidenceComplete: true,
      providerZeroVerified: true,
    });
    expect(adapter.events).toEqual([
      "consume-graduation-approval",
      "preflight",
      "candidate",
      "independent-review",
      "delivery",
      "read-merge-approval",
      "consume-merge-approval",
      "merge",
      "canonical-equality",
      "rollback",
      "cleanup",
      "terminate-paid-resources",
      "provider-zero",
    ]);
    expect(result.events.map((event) => event.stage)).toEqual([
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
    ]);
    expect(verifyPhaseZeroGraduationEventChain(result.events)).toBe(true);
    expect(
      result.events.every((event) => /^sha256:[a-f0-9]{64}$/u.test(event.evidenceDigest)),
    ).toBe(true);
    const tampered = result.events.map((event, index) =>
      index === 2 ? { ...event, evidence: { forged: true } } : event,
    );
    expect(verifyPhaseZeroGraduationEventChain(tampered)).toBe(false);
  });

  it("denies altered, future, and expired approvals before durable consumption", async () => {
    const current = proposal();
    const expired = proposal({ expiresAt: "2026-08-06T12:20:00.000Z" });
    const futureApproval = {
      ...approval(current),
      issuedAt: "2026-08-06T12:31:00.000Z",
      authentication: {
        ...approval(current).authentication,
        authenticatedAt: "2026-08-06T12:30:30.000Z",
      },
    };
    const cases = [
      { current, currentApproval: { ...approval(current), typedStatement: "wrong" } },
      { current, currentApproval: futureApproval },
      { current: expired, currentApproval: approval(expired) },
    ];

    for (const currentCase of cases) {
      const adapter = new ContractAdapter();
      const result = await runtime(adapter).execute(
        currentCase.current,
        currentCase.currentApproval,
      );
      expect(result).toMatchObject({
        status: "denied",
        approvalConsumed: false,
        mergeApprovalConsumed: false,
        canonicalRepositoryChanged: null,
        canonicalRepositoryChangeVerified: false,
        phase0GraduationEvidenceComplete: false,
        providerZeroVerified: false,
      });
      expect(adapter.events).toEqual([]);
    }
  });

  it("denies replay through the durable approval ledger", async () => {
    const adapter = new ContractAdapter();
    const current = proposal();
    expect((await runtime(adapter).execute(current, approval(current))).status).toBe("succeeded");
    const replay = await runtime(adapter).execute(current, approval(current));
    expect(replay).toMatchObject({ status: "denied", approvalConsumed: "unknown" });
    expect(adapter.events.at(-1)).toBe("consume-graduation-approval");
  });

  it("reports unknown rather than false when either approval ledger mutates and then throws", async () => {
    const current = proposal();
    const graduationAdapter = new ContractAdapter();
    graduationAdapter.graduationApprovalMutatesThenThrows = true;
    const graduationResult = await runtime(graduationAdapter).execute(current, approval(current));
    expect(graduationResult).toMatchObject({
      status: "denied",
      approvalConsumed: "unknown",
      mergeApprovalConsumed: false,
    });

    const mergeAdapter = new ContractAdapter();
    mergeAdapter.mergeApprovalMutatesThenThrows = true;
    const mergeResult = await runtime(mergeAdapter).execute(current, approval(current));
    expect(mergeResult).toMatchObject({
      status: "failed",
      stage: "merge-approval",
      approvalConsumed: true,
      mergeApprovalConsumed: "unknown",
      phase0GraduationEvidenceComplete: false,
    });
  });

  it("rejects non-IRIS, fixture, operator mutation, stale inspection, and underbound worker proposals", () => {
    const current = proposal();
    const wrongBaseExecutable = { ...executableProposal(), baseRevision: "f".repeat(40) };
    const singleFileExecutable = {
      ...executableProposal(),
      writePaths: ["packages/development/src/example.ts"],
      maximumChangedFiles: 1,
    };
    const protectedPathExecutable = {
      ...executableProposal(),
      writePaths: ["AGENTS.md", "tests/example.test.ts"],
    };
    const underSizedExecutable = { ...executableProposal(), maximumChangedFiles: 1 };
    const overlongExecutable = {
      ...executableProposal(),
      expiresAt: "2026-08-06T13:30:00.000Z",
    };
    for (const altered of [
      { ...current, actor: "Codex" },
      { ...current, deployedRuntime: false },
      { ...current, fixtureExecution: true },
      { ...current, codexMutation: true },
      { ...current, claudeMutation: true },
      { ...current, model: { ...current.model, name: "dummy-model" } },
      { ...current, model: { ...current.model, inspectedAt: "2026-08-06T12:01:00.000Z" } },
      {
        ...current,
        executableWorkerProposal: wrongBaseExecutable,
        executableWorkerProposalDigest: executableWorkerProposalDigest(wrongBaseExecutable),
      },
      {
        ...current,
        executableWorkerProposal: singleFileExecutable,
        executableWorkerProposalDigest: executableWorkerProposalDigest(singleFileExecutable),
      },
      {
        ...current,
        executableWorkerProposal: protectedPathExecutable,
        executableWorkerProposalDigest: executableWorkerProposalDigest(protectedPathExecutable),
      },
      {
        ...current,
        executableWorkerProposal: underSizedExecutable,
        executableWorkerProposalDigest: executableWorkerProposalDigest(underSizedExecutable),
      },
      {
        ...current,
        executableWorkerProposal: overlongExecutable,
        executableWorkerProposalDigest: executableWorkerProposalDigest(overlongExecutable),
      },
    ])
      expect(() => phaseZeroGraduationProposalSchema.parse(altered)).toThrow();
  });

  it("fails closed before delivery for any reviewer other than the exact IRIS reviewer", async () => {
    const adapter = new ContractAdapter();
    adapter.reviewerId = "claude";
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current));
    expect(result).toMatchObject({
      status: "failed",
      stage: "independent-review",
      canonicalRepositoryChanged: false,
      canonicalRepositoryChangeVerified: true,
      phase0GraduationEvidenceComplete: false,
    });
    expect(adapter.events).not.toContain("delivery");
    expect(verifyPhaseZeroGraduationEventChain(result.events)).toBe(true);
  });

  it.each([
    [
      "local base drift",
      (a: ContractAdapter): void => {
        a.preflightLocalRevision = "f".repeat(40);
      },
      "preflight",
    ],
    [
      "remote base drift",
      (a: ContractAdapter): void => {
        a.preflightRemoteRevision = "f".repeat(40);
      },
      "preflight",
    ],
    [
      "provider base drift",
      (a: ContractAdapter): void => {
        a.preflightProviderRevision = "f".repeat(40);
      },
      "preflight",
    ],
    [
      "Command Center base drift",
      (a: ContractAdapter): void => {
        a.preflightCommandCenterRevision = "f".repeat(40);
      },
      "preflight",
    ],
    [
      "single-file candidate",
      (a: ContractAdapter): void => {
        a.candidateChangedPaths = ["packages/development/src/example.ts"];
      },
      "candidate",
    ],
    [
      "unchanged candidate commit",
      (a: ContractAdapter): void => {
        a.candidateCommitValue = baseRevision;
      },
      "candidate",
    ],
    [
      "unverified base ancestry",
      (a: ContractAdapter): void => {
        a.candidateBaseAncestorVerified = false;
      },
      "candidate",
    ],
    [
      "unchanged candidate tree",
      (a: ContractAdapter): void => {
        a.candidateTreeDigest = baseTreeDigest;
      },
      "candidate",
    ],
    [
      "future model observation",
      (a: ContractAdapter): void => {
        a.modelObservedAt = "2026-08-06T12:31:00.000Z";
      },
      "candidate",
    ],
    [
      "reviewed diff drift",
      (a: ContractAdapter): void => {
        a.reviewDiffDigest = `sha256:${"4".repeat(64)}`;
      },
      "independent-review",
    ],
    [
      "unreviewed delivery commit",
      (a: ContractAdapter): void => {
        a.deliveredCommit = "f".repeat(40);
      },
      "delivery",
    ],
    [
      "checkpoint inequality",
      (a: ContractAdapter): void => {
        a.checkpointRemoteRevision = "f".repeat(40);
      },
      "delivery",
    ],
    [
      "pull-request head drift",
      (a: ContractAdapter): void => {
        a.pullRequestHead = "f".repeat(40);
      },
      "delivery",
    ],
    [
      "pull-request URL drift",
      (a: ContractAdapter): void => {
        a.pullRequestUrl = "https://example.test/stoic1712-IRIS/IRIS/pull/90";
      },
      "delivery",
    ],
    [
      "merge head drift",
      (a: ContractAdapter): void => {
        a.mergeExpectedHead = "f".repeat(40);
      },
      "merge",
    ],
    [
      "merge first-parent drift",
      (a: ContractAdapter): void => {
        a.mergeFirstParent = "f".repeat(40);
      },
      "merge",
    ],
    [
      "merge second-parent drift",
      (a: ContractAdapter): void => {
        a.mergeSecondParent = "f".repeat(40);
      },
      "merge",
    ],
    [
      "canonical-main inequality",
      (a: ContractAdapter): void => {
        a.canonicalRemoteRevision = "f".repeat(40);
      },
      "canonical-equality",
    ],
    [
      "invalid merge rollback",
      (a: ContractAdapter): void => {
        a.rollbackCommand = `git revert ${mergeCommit}`;
      },
      "rollback",
    ],
    [
      "cleanup failure",
      (a: ContractAdapter): void => {
        a.cleanupVerified = false;
      },
      "cleanup",
    ],
    [
      "future resource-termination evidence",
      (a: ContractAdapter): void => {
        a.resourceVerifiedAt = "2026-08-06T12:31:00.000Z";
      },
      "resource-termination",
    ],
    [
      "future provider evidence",
      (a: ContractAdapter): void => {
        a.providerVerifiedAt = "2026-08-06T12:31:00.000Z";
      },
      "provider-zero",
    ],
  ] as const)("fails closed on %s", async (_name, alter, expectedStage) => {
    const adapter = new ContractAdapter();
    alter(adapter);
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current));
    expect(result).toMatchObject({
      status: "failed",
      stage: expectedStage,
      phase0GraduationEvidenceComplete: false,
    });
    expect(verifyPhaseZeroGraduationEventChain(result.events)).toBe(true);
  });

  it("truthfully detects provider mutation even when merge throws", async () => {
    const adapter = new ContractAdapter();
    adapter.mergeMutatesThenThrows = true;
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current));
    expect(result).toMatchObject({
      status: "failed",
      stage: "merge",
      canonicalRepositoryChanged: true,
      canonicalRepositoryChangeVerified: true,
      phase0GraduationEvidenceComplete: false,
    });
  });

  it("reports provider residue and unknown provider state without false zero claims", async () => {
    const residueAdapter = new ContractAdapter();
    residueAdapter.providerResourceState = ["github-actions-run:123"];
    const current = proposal();
    const residue = await runtime(residueAdapter).execute(current, approval(current));
    expect(residue).toMatchObject({
      status: "failed",
      stage: "provider-zero",
      providerZeroVerified: false,
      phase0GraduationEvidenceComplete: false,
    });
    expect(
      residueAdapter.events.filter((event) => event === "terminate-paid-resources"),
    ).toHaveLength(1);
    expect(residueAdapter.events.filter((event) => event === "provider-zero")).toHaveLength(1);

    const unknownAdapter = new ContractAdapter();
    unknownAdapter.providerInspectionFails = true;
    const unknown = await runtime(unknownAdapter).execute(current, approval(current));
    expect(unknown).toMatchObject({
      status: "failed",
      stage: "provider-zero",
      canonicalRepositoryChanged: null,
      canonicalRepositoryChangeVerified: false,
      providerZeroVerified: false,
    });
  });

  it("keeps the repository-wide self-description incomplete after local machinery tests", () => {
    expect(getSovereignDevelopmentSelfDescription().graduationEvidenceComplete).toBe(false);
  });
});
