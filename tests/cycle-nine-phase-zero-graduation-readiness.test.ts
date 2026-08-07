import { describe, expect, it } from "vitest";

import {
  PhaseZeroGraduationRuntime,
  getSovereignDevelopmentSelfDescription,
  phaseZeroGraduationProposalDigest,
  phaseZeroGraduationProposalSchema,
  requiredPhaseZeroGraduationApproval,
  type PhaseZeroCandidate,
  type PhaseZeroCleanupEvidence,
  type PhaseZeroDelivery,
  type PhaseZeroGraduationAdapter,
  type PhaseZeroGraduationApproval,
  type PhaseZeroGraduationProposal,
  type PhaseZeroIndependentReview,
  type PhaseZeroMerge,
  type PhaseZeroPreflight,
} from "../packages/development/src/index.js";

const baseRevision = "a".repeat(40);
const commandCenterRevision = "b".repeat(40);
const candidateCommit = "c".repeat(40);
const deliveryCommit = "d".repeat(40);
const mergeCommit = "e".repeat(40);
const createdAt = "2026-08-06T12:00:00.000Z";

function proposal(
  overrides: Partial<PhaseZeroGraduationProposal> = {},
): PhaseZeroGraduationProposal {
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
    },
    executableWorkerProposalDigest: `sha256:${"1".repeat(64)}`,
    executableWorkerExecutionId: "execution_cycle8-phase0-final-0001",
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
    typedStatement: requiredPhaseZeroGraduationApproval(current),
    oneTime: true,
    issuedAt: "2026-08-06T12:01:00.000Z",
  };
}

class ContractAdapter implements PhaseZeroGraduationAdapter {
  readonly events: string[] = [];
  failAt: string | undefined;
  providerResourceState: string[] = [];
  reviewerId = "iris-independent-reviewer";
  reviewCommit = candidateCommit;
  checkpointRemoteRevision = deliveryCommit;
  pullRequestHead = deliveryCommit;
  mergeExpectedHead = deliveryCommit;
  canonicalRemoteRevision = mergeCommit;

  #record(name: string): void {
    this.events.push(name);
    if (this.failAt === name) throw new Error(`CONTRACT_FAILURE:${name}`);
  }

  preflight(): Promise<PhaseZeroPreflight> {
    this.#record("preflight");
    return Promise.resolve({
      actor: "IRIS",
      deployedRuntime: true,
      deploymentId: "deployment_phase0-local",
      canonicalLocalRevision: baseRevision,
      canonicalRemoteRevision: baseRevision,
      providerMainRevision: baseRevision,
      commandCenterRevision,
      commandCenterConnected: true,
      modelProvider: "ollama",
      modelName: "qwen3-coder:30b",
      modelReady: true,
      checkpointRepositoryPrivate: true,
      ephemeralCredentialReady: true,
      currentProviderResources: [],
    });
  }

  executeCandidate(): Promise<PhaseZeroCandidate> {
    this.#record("candidate");
    return Promise.resolve({
      executionId: "execution_cycle8-phase0-final-0001",
      executableWorkerProposalDigest: `sha256:${"1".repeat(64)}`,
      producerId: "iris-development-worker",
      status: "succeeded",
      candidateCommit,
      candidateRef: "refs/heads/iris/candidate/phase0-final-0001",
      changedPaths: ["packages/development/src/example.ts", "tests/example.test.ts"],
      verificationCommands: [["pnpm", "verify"]],
      checksPassed: true,
      workerApprovalConsumed: true,
      eventChainVerified: true,
      workspaceCleanupVerified: true,
      realModelObserved: true,
      modelProvider: "ollama",
      modelName: "qwen3-coder:30b",
    });
  }

  independentlyReview(): Promise<PhaseZeroIndependentReview> {
    this.#record("independent-review");
    return Promise.resolve({
      reviewerId: this.reviewerId,
      reviewedCommit: this.reviewCommit,
      verdict: "pass",
      findings: [],
      verificationCommands: [["pnpm", "verify"]],
      checksPassed: true,
      canonicalRepositoryChanged: false,
    });
  }

  deliver(): Promise<PhaseZeroDelivery> {
    this.#record("delivery");
    return Promise.resolve({
      deliveryCommit,
      checkpointRef: "checkpoint/phase-zero-aaaaaaaaaaaa",
      checkpointCommit: deliveryCommit,
      checkpointRemoteRevision: this.checkpointRemoteRevision,
      checkpointCreatedFirst: true,
      targetBranch: "iris/phase-zero-graduation-aaaaaaaaaaaa",
      targetCommit: deliveryCommit,
      targetRemoteRevision: deliveryCommit,
      pullRequest: {
        number: 90,
        url: "https://github.com/stoic1712-IRIS/IRIS/pull/90",
        headCommit: this.pullRequestHead,
        draft: true,
      },
      credentialCleared: true,
      workspaceCleanupVerified: true,
    });
  }

  merge(): Promise<PhaseZeroMerge> {
    this.#record("merge");
    return Promise.resolve({
      pullRequestNumber: 90,
      expectedHeadCommit: this.mergeExpectedHead,
      mergeCommit,
      providerMainRevision: mergeCommit,
      mergeMethod: "merge-commit",
      independentReviewConsumed: true,
      mergeApprovalConsumed: true,
    });
  }

  verifyCanonicalEquality() {
    this.#record("canonical-equality");
    return Promise.resolve({
      localMainRevision: mergeCommit,
      remoteMainRevision: this.canonicalRemoteRevision,
      providerMainRevision: mergeCommit,
    });
  }

  preserveRollbackEvidence() {
    this.#record("rollback");
    return Promise.resolve({
      mergeCommit,
      strategy: "revert" as const,
      command: `git revert ${mergeCommit}`,
      mergeCommitIsAncestor: true as const,
      privateCheckpointRecoverable: true as const,
      preservesHistory: true as const,
    });
  }

  cleanup(): Promise<PhaseZeroCleanupEvidence> {
    this.#record("cleanup");
    return Promise.resolve({
      executionWorkspaceRemoved: true,
      deliveryWorkspaceRemoved: true,
      journalPreserved: true,
      credentialCleared: true,
    });
  }

  terminatePaidResources(): Promise<string[]> {
    this.#record("terminate-paid-resources");
    return Promise.resolve([]);
  }

  providerResources(): Promise<string[]> {
    this.#record("provider-zero");
    return Promise.resolve(this.providerResourceState);
  }
}

function runtime(adapter: PhaseZeroGraduationAdapter) {
  return new PhaseZeroGraduationRuntime({
    adapter,
    now: () => new Date("2026-08-06T12:02:00.000Z"),
  });
}

describe("Cycle Nine Phase 0 graduation-readiness controller", () => {
  it("binds the complete IRIS-owned chain and produces hash-linked evidence", async () => {
    const adapter = new ContractAdapter();
    const current = proposal();
    const approvalState = { consumed: false };
    const result = await runtime(adapter).execute(current, approval(current), approvalState);

    expect(result).toMatchObject({
      status: "succeeded",
      stage: "completed",
      approvalConsumed: true,
      canonicalRepositoryChanged: true,
      phase0GraduationEvidenceComplete: true,
      providerZeroVerified: true,
    });
    expect(adapter.events).toEqual([
      "preflight",
      "candidate",
      "independent-review",
      "delivery",
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
      "merge",
      "canonical-equality",
      "rollback",
      "cleanup",
      "provider-zero",
      "completed",
    ]);
    expect(result.events[0]?.previousDigest).toBeNull();
    expect(
      result.events
        .slice(1)
        .every((event, index) => event.previousDigest === result.events[index]?.digest),
    ).toBe(true);
  });

  it("denies altered, consumed, and expired approval before any adapter call", async () => {
    const cases: {
      current: PhaseZeroGraduationProposal;
      currentApproval: PhaseZeroGraduationApproval;
      consumed: boolean;
    }[] = [];
    const current = proposal();
    cases.push({
      current,
      currentApproval: { ...approval(current), typedStatement: "I approve something else." },
      consumed: false,
    });
    cases.push({ current, currentApproval: approval(current), consumed: true });
    const expired = proposal({ expiresAt: "2026-08-06T12:01:30.000Z" });
    cases.push({
      current: expired,
      currentApproval: {
        ...approval(expired),
        issuedAt: "2026-08-06T12:01:00.000Z",
      },
      consumed: false,
    });

    for (const currentCase of cases) {
      const adapter = new ContractAdapter();
      const approvalState = { consumed: currentCase.consumed };
      const result = await runtime(adapter).execute(
        currentCase.current,
        currentCase.currentApproval,
        approvalState,
      );
      expect(result).toMatchObject({
        status: "denied",
        approvalConsumed: currentCase.consumed,
        canonicalRepositoryChanged: false,
        phase0GraduationEvidenceComplete: false,
        providerZeroVerified: false,
      });
      expect(adapter.events).toEqual([]);
    }
  });

  it("rejects non-IRIS, non-deployed, fixture, and assistant-mutated proposals", () => {
    const current = proposal();
    for (const altered of [
      { ...current, actor: "Codex" },
      { ...current, deployedRuntime: false },
      { ...current, fixtureExecution: true },
      { ...current, codexMutation: true },
      { ...current, claudeMutation: true },
      { ...current, model: { ...current.model, name: "fixture-model" } },
    ]) {
      expect(() => phaseZeroGraduationProposalSchema.parse(altered)).toThrow();
    }
  });

  it("fails closed before delivery when the producer reviews its own candidate", async () => {
    const adapter = new ContractAdapter();
    adapter.reviewerId = "iris-development-worker";
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current), { consumed: false });
    expect(result).toMatchObject({
      status: "failed",
      stage: "independent-review",
      canonicalRepositoryChanged: false,
      phase0GraduationEvidenceComplete: false,
    });
    expect(adapter.events).not.toContain("delivery");
  });

  it.each([
    [
      "checkpoint inequality",
      (adapter: ContractAdapter) => {
        adapter.checkpointRemoteRevision = "f".repeat(40);
      },
      "delivery",
    ],
    [
      "pull-request head drift",
      (adapter: ContractAdapter) => {
        adapter.pullRequestHead = "f".repeat(40);
      },
      "delivery",
    ],
    [
      "merge head drift",
      (adapter: ContractAdapter) => {
        adapter.mergeExpectedHead = "f".repeat(40);
      },
      "merge",
    ],
    [
      "canonical-main inequality",
      (adapter: ContractAdapter) => {
        adapter.canonicalRemoteRevision = "f".repeat(40);
      },
      "canonical-equality",
    ],
  ] as const)("fails closed on %s", async (_name, alter, expectedStage) => {
    const adapter = new ContractAdapter();
    alter(adapter);
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current), { consumed: false });
    expect(result).toMatchObject({
      status: "failed",
      stage: expectedStage,
      canonicalRepositoryChanged:
        expectedStage === "merge" || expectedStage === "canonical-equality",
      phase0GraduationEvidenceComplete: false,
    });
  });

  it("reports provider residue as failure after attempting termination and cleanup", async () => {
    const adapter = new ContractAdapter();
    adapter.providerResourceState = ["github-actions-run:123"];
    const current = proposal();
    const result = await runtime(adapter).execute(current, approval(current), { consumed: false });
    expect(result).toMatchObject({
      status: "failed",
      stage: "provider-zero",
      phase0GraduationEvidenceComplete: false,
      providerZeroVerified: false,
    });
    expect(adapter.events.filter((event) => event === "terminate-paid-resources")).toHaveLength(2);
    expect(adapter.events.filter((event) => event === "provider-zero")).toHaveLength(2);
  });

  it("keeps the repository-wide self-description incomplete after local machinery tests", () => {
    expect(getSovereignDevelopmentSelfDescription().graduationEvidenceComplete).toBe(false);
  });
});
