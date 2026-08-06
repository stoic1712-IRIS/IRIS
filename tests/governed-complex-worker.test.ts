import { describe, expect, it } from "vitest";
import {
  CognitiveProcessManager,
  createCodingWorkerAuthorization,
  createWorkerEvaluation,
  generateWorkerSpecification,
  type WorkerContext,
  type WorkerRuntimeAdapter,
  type WorkerSpecification,
} from "../packages/workers/src/index.js";

const now = "2026-08-05T23:00:00.000Z";
const codingWorker = generateWorkerSpecification({
  workerId: "worker_bounded-coder",
  workerClass: "coding",
  identity: { name: "Bounded Coder", role: "Repair approved files.", authority: "none" },
  mission: {
    objective: "Repair a fictional defect.",
    taskId: "task_fictional-repair",
    prohibitedObjectives: ["modify canonical main", "use network", "self-approve"],
  },
  reasoning: {
    instructions: ["Edit only approved files.", "Run fixed checks."],
    mustCiteEvidence: true,
    maySelfApprove: false,
    mayDelegate: false,
  },
  memory: {
    categories: ["project", "knowledge"],
    maximumSensitivity: "internal",
    maximumItems: 20,
  },
  tools: { commandAllowlist: ["pnpm test"], shell: false },
  network: { mode: "none", allowedHosts: [] },
  resources: { timeoutMs: 1_000, memoryMiB: 512, cpuCount: 1, gpuVramMiB: 0, processLimit: 64 },
  success: {
    requiredOutputFields: ["changedFiles", "verification"],
    independentVerification: true,
  },
  cleanup: { terminateWorker: true, deleteWorkspace: true, verifyZeroResources: true },
  model: { provider: "fixture", model: "bounded-coder-v1", purpose: "fictional-repair" },
  createdAt: now,
  requestedPaths: ["src"],
  requestedWritePaths: ["src/fix.ts"],
  requestedTools: ["read-file", "write-file"],
  codingWorkerGatePassed: true,
});

const context: WorkerContext = {
  objective: "Repair.",
  repositoryFiles: [],
  memories: [],
  constraints: ["disposable only"],
};

class CodingRuntime implements WorkerRuntimeAdapter {
  readonly provider = "fictional-disposable-runtime";
  prepared = 0;
  prepare(_specification: WorkerSpecification) {
    void _specification;
    this.prepared++;
    return Promise.resolve({
      workspaceId: "workspace_coding",
      readOnly: false,
      disposable: true as const,
    });
  }
  launch() {
    return Promise.resolve({
      status: "succeeded" as const,
      output: { changedFiles: ["src/fix.ts"], verification: "passed" },
      reportedTools: ["write-file"],
      reportedPaths: ["src/fix.ts"],
      summary: "Fictional repair verified.",
    });
  }
  terminate() {
    return Promise.resolve();
  }
  cleanup() {
    return Promise.resolve(true);
  }
}

describe("governed complex coding workers", () => {
  it("derives minimum non-expandable write scope", () => {
    expect(codingWorker.permissions.writePaths).toEqual(["src/fix.ts"]);
    expect(codingWorker.permissions.mayExpand).toBe(false);
    expect(codingWorker.network.mode).toBe("none");
  });

  it("denies coding execution before exact Founder authorization", async () => {
    const runtime = new CodingRuntime();
    const manager = new CognitiveProcessManager({
      adapter: runtime,
      now: () => now,
      publish: () => Promise.resolve(),
    });
    expect((await manager.execute(codingWorker, context)).status).toBe("denied");
    expect(runtime.prepared).toBe(0);
  });

  it("runs one disposable coding lifecycle after exact approval", async () => {
    const runtime = new CodingRuntime();
    const manager = new CognitiveProcessManager({
      adapter: runtime,
      now: () => now,
      publish: () => Promise.resolve(),
    });
    const authorization = createCodingWorkerAuthorization(
      codingWorker,
      [["pnpm", "test"]],
      new Date(now),
    );
    const result = await manager.execute(codingWorker, context, {
      authorization,
      typedStatement: authorization.approvalStatement,
      now: new Date("2026-08-05T23:00:30.000Z"),
    });
    expect(result.status).toBe("succeeded");
    expect(result.cleanupVerified).toBe(true);
  });

  it("turns outcomes into evidence-bound learning proposals, never automatic memory", () => {
    const evaluation = createWorkerEvaluation({
      workerId: codingWorker.workerId,
      workerDigest: createCodingWorkerAuthorization(codingWorker, [["pnpm", "test"]]).workerDigest,
      missionId: codingWorker.mission.taskId,
      outcome: "accepted",
      passedChecks: ["tests"],
      failedChecks: [],
      founderFeedback: "Keep the narrow write boundary.",
      evidenceDigests: [`sha256:${"a".repeat(64)}`],
    });
    expect(evaluation.status).toBe("pending-founder-approval");
    expect(evaluation.canonicalMemoryMutation).toBe(false);
  });
});
