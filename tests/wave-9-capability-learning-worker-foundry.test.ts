import { describe, expect, it } from "vitest";

import {
  CapabilityLearningEngine,
  WorkerFoundry,
  capabilityCandidateSchema,
  capabilityReviewSchema,
  digest,
  type CapabilityDecision,
} from "../packages/capabilities/src/index.js";
import {
  CognitiveProcessManager,
  assembleWorkerContext,
  workerSpecificationSchema,
  type WorkerRuntimeAdapter,
} from "../packages/workers/src/index.js";

const now = "2026-08-05T12:00:00-06:00";
const candidate = capabilityCandidateSchema.parse({
  candidateId: "openclaw-bounded-execution",
  name: "OpenClaw bounded execution pattern",
  sourceIdentity: "https://github.com/openclaw/openclaw",
  sourceRevision: "0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c",
  sourceLicense: "MIT",
  reviewedAt: now,
  proposedPatterns: ["bounded task execution", "explicit lifecycle cleanup"],
  copiedSourceCode: false,
});
const review = capabilityReviewSchema.parse({
  candidateId: candidate.candidateId,
  provenance: { identityVerified: true, revisionPinned: true },
  license: { reviewed: true, patternUsePermitted: true, obligations: ["No copied code"] },
  security: { reviewed: true, unacceptableRisks: [], requiresRuntime: false },
  mapping: [
    {
      pattern: "bounded task execution",
      irisCapability: "read-only evidence verification",
      boundary: "IRIS owns identity, authorization, execution, and cleanup",
    },
  ],
  extractedPrinciples: ["Fix permissions before launch", "Always terminate and verify cleanup"],
});

function decision(): CapabilityDecision {
  return new CapabilityLearningEngine().evaluate(candidate, review);
}

function proposal() {
  const currentDecision = decision();
  return new WorkerFoundry().generate({
    decision: currentDecision,
    approval: {
      approvalId: "approval-wave-9-pattern",
      candidateId: candidate.candidateId,
      reviewDigest: currentDecision.reviewDigest,
      decision: "approved",
      actor: "Founder",
      approvedAt: now,
    },
    worker: {
      workerId: "worker_evidence-verifier",
      workerClass: "read-only",
      identity: {
        name: "Evidence Verifier",
        role: "Verify a bounded evidence manifest using IRIS-owned logic.",
        authority: "none",
      },
      mission: {
        objective: "Verify evidence paths and produce citations.",
        taskId: "task_evidence-verification",
        prohibitedObjectives: ["modify evidence", "approve output", "activate itself"],
      },
      reasoning: {
        instructions: ["Inspect only the supplied manifest.", "Cite every verified path."],
        mustCiteEvidence: true,
        maySelfApprove: false,
        mayDelegate: false,
      },
      memory: {
        categories: ["project", "audit"],
        maximumSensitivity: "internal",
        maximumItems: 10,
      },
      tools: { commandAllowlist: ["verify-manifest"], shell: false },
      network: { mode: "none", allowedHosts: [] },
      resources: {
        timeoutMs: 1_000,
        memoryMiB: 128,
        cpuCount: 1,
        gpuVramMiB: 0,
        processLimit: 32,
      },
      success: { requiredOutputFields: ["valid", "citations"], independentVerification: true },
      cleanup: { terminateWorker: true, deleteWorkspace: true, verifyZeroResources: true },
      model: {
        provider: "deterministic",
        model: "iris-evidence-verifier-v1",
        purpose: "evidence-verification",
      },
      createdAt: now,
      requestedPaths: ["evidence"],
      requestedTools: ["inspect-metadata"],
    },
  });
}

describe("Wave 9 Capability Learning Engine", () => {
  it("recommends an original IRIS build after provenance, license, security, and mapping pass", () => {
    expect(decision()).toMatchObject({
      recommendation: "build",
      reviewDigest: digest(review),
    });
  });

  it.each([
    ["provenance", { ...review, provenance: { ...review.provenance, identityVerified: false } }],
    ["license", { ...review, license: { ...review.license, patternUsePermitted: false } }],
    ["security", { ...review, security: { ...review.security, unacceptableRisks: ["shell"] } }],
    ["mapping", { ...review, mapping: [] }],
  ])("rejects a candidate that fails %s review", (_label, invalidReview) => {
    expect(new CapabilityLearningEngine().evaluate(candidate, invalidReview).recommendation).toBe(
      "reject",
    );
  });

  it("recommends adoption only when an external runtime is genuinely required", () => {
    expect(
      new CapabilityLearningEngine().evaluate(candidate, {
        ...review,
        security: { ...review.security, requiresRuntime: true },
      }).recommendation,
    ).toBe("adopt");
  });
});

describe("Wave 9 Worker Foundry", () => {
  it("generates an original, dependency-free worker proposal and complete artifact set", () => {
    expect(proposal()).toMatchObject({
      status: "requires-founder-approval",
      maySelfApprove: false,
      maySelfActivate: false,
      originalImplementation: true,
      copiedSourceCode: false,
      externalRuntimeDependencies: [],
      worker: { workerId: "worker_evidence-verifier", workerClass: "read-only" },
    });
    expect(proposal().artifacts.testTemplates).toHaveLength(3);
  });

  it("rejects an approval that does not match the reviewed decision", () => {
    const currentDecision = decision();
    expect(() =>
      new WorkerFoundry().generate({
        decision: currentDecision,
        approval: {
          approvalId: "approval-wrong-review",
          candidateId: candidate.candidateId,
          reviewDigest: `sha256:${"0".repeat(64)}`,
          decision: "approved",
          actor: "Founder",
          approvedAt: now,
        },
        worker: proposal().worker,
      } as never),
    ).toThrow(/does not match/);
  });

  it("cannot approve or activate its generated worker", () => {
    expect(() => new WorkerFoundry().activate(proposal())).toThrow(/cannot approve or activate/);
  });

  it("runs through the IRIS lifecycle with no external runtime present", async () => {
    expect(proposal().externalRuntimeDependencies).toEqual([]);
    const runtime: WorkerRuntimeAdapter = {
      provider: "iris-native-deterministic",
      prepare: () =>
        Promise.resolve({ workspaceId: "workspace_wave9", readOnly: true, disposable: true }),
      launch: () =>
        Promise.resolve({
          status: "succeeded",
          output: { valid: true, citations: ["evidence:manifest.json"] },
          reportedTools: ["inspect-metadata"],
          reportedPaths: ["evidence/manifest.json"],
          summary: "IRIS-native evidence verification completed.",
        }),
      terminate: () => Promise.resolve(),
      cleanup: () => Promise.resolve(true),
    };
    const manager = new CognitiveProcessManager({
      adapter: runtime,
      now: () => now,
      publish: () => Promise.resolve(),
    });
    const worker = workerSpecificationSchema.parse(proposal().worker);
    const result = await manager.execute(
      worker,
      assembleWorkerContext({
        specification: worker,
        objective: worker.mission.objective,
        repositoryFiles: [{ path: "evidence/manifest.json", citation: "evidence:manifest.json" }],
        memories: [],
        constraints: ["external system absent", "read-only", "no network"],
      }),
    );
    expect(result).toMatchObject({ status: "succeeded", cleanupVerified: true });
  });
});
