import { describe, expect, it } from "vitest";

import {
  CognitiveProcessManager,
  assembleWorkerContext,
  assignModel,
  calculateMinimumPermissions,
  generateWorkerSpecification,
  workerSpecificationSchema,
  type WorkerContext,
  type WorkerLifecycleEvent,
  type WorkerRuntimeAdapter,
  type WorkerRuntimeResult,
  type WorkerSpecification,
} from "../packages/workers/src/index.js";

const now = "2026-08-05T10:00:00-06:00";

function specification(overrides: Partial<WorkerSpecification> = {}): WorkerSpecification {
  return workerSpecificationSchema.parse({
    workerId: "worker_repository-cartographer",
    workerClass: "read-only",
    identity: {
      name: "Repository Cartographer",
      role: "Inspect a disposable repository snapshot.",
      authority: "none",
    },
    mission: {
      objective: "Inventory the snapshot and cite evidence.",
      taskId: "task_repository-cartography",
      prohibitedObjectives: ["modify files", "delegate work", "approve output"],
    },
    reasoning: {
      instructions: ["Use deterministic inspection only.", "Cite repository paths."],
      mustCiteEvidence: true,
      maySelfApprove: false,
      mayDelegate: false,
    },
    permissions: {
      tools: ["list-files", "inspect-metadata"],
      readPaths: ["snapshot"],
      writePaths: [],
      mayExpand: false,
    },
    memory: {
      categories: ["project", "knowledge"],
      maximumSensitivity: "internal",
      maximumItems: 10,
    },
    tools: { commandAllowlist: ["node repository-cartographer.mjs"], shell: false },
    network: { mode: "none", allowedHosts: [] },
    resources: { timeoutMs: 100, memoryMiB: 256, cpuCount: 1, gpuVramMiB: 0, processLimit: 64 },
    success: { requiredOutputFields: ["fileCount", "citations"], independentVerification: true },
    cleanup: { terminateWorker: true, deleteWorkspace: true, verifyZeroResources: true },
    model: {
      provider: "deterministic",
      model: "repository-cartographer-v1",
      purpose: "repository-inspection",
    },
    createdAt: now,
    ...overrides,
  });
}

const context: WorkerContext = {
  objective: "Inventory the snapshot.",
  repositoryFiles: [{ path: "snapshot/README.md", citation: "repository:README.md" }],
  memories: [],
  constraints: ["read-only", "no network", "no delegation"],
};

class FixtureRuntime implements WorkerRuntimeAdapter {
  readonly provider = "fixture-runtime";
  prepared = 0;
  launched = 0;
  terminated = 0;
  cleaned = 0;
  cleanupResult = true;
  result: WorkerRuntimeResult = {
    status: "succeeded",
    output: { fileCount: 1, citations: ["repository:README.md"] },
    reportedTools: ["list-files"],
    reportedPaths: ["snapshot/README.md"],
    summary: "Read-only snapshot inventoried.",
  };
  delayMs = 0;

  prepare(_specification: WorkerSpecification) {
    void _specification;
    this.prepared += 1;
    return Promise.resolve({
      workspaceId: "workspace_fixture",
      readOnly: true,
      disposable: true as const,
    });
  }
  async launch(
    _specification: WorkerSpecification,
    _context: WorkerContext,
    _workspaceId: string,
    signal: AbortSignal,
  ) {
    void _specification;
    void _context;
    void _workspaceId;
    this.launched += 1;
    if (this.delayMs > 0)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.delayMs);
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    return this.result;
  }
  terminate(_workerId: string) {
    void _workerId;
    this.terminated += 1;
    return Promise.resolve();
  }
  cleanup(_workspaceId: string) {
    void _workspaceId;
    this.cleaned += 1;
    return Promise.resolve(this.cleanupResult);
  }
}

function harness(runtime = new FixtureRuntime()) {
  const events: WorkerLifecycleEvent[] = [];
  const manager = new CognitiveProcessManager({
    adapter: runtime,
    now: () => now,
    publish: (event) => {
      events.push(event);
      return Promise.resolve();
    },
  });
  return { manager, runtime, events };
}

describe("Wave 8 Worker Factory", () => {
  it("calculates a non-expandable read-only minimum permission set", () => {
    expect(
      calculateMinimumPermissions({
        readOnly: true,
        requestedPaths: ["snapshot", "snapshot"],
        requestedTools: ["list-files"],
      }),
    ).toEqual({ tools: ["list-files"], readPaths: ["snapshot"], writePaths: [], mayExpand: false });
    expect(() =>
      calculateMinimumPermissions({
        readOnly: true,
        requestedPaths: ["snapshot"],
        requestedTools: ["write-file"],
      }),
    ).toThrow(/mutating/);
  });

  it("keeps coding workers disabled until the read-only gate passes", () => {
    const base = specification({ workerClass: "coding" });
    expect(() =>
      generateWorkerSpecification({
        ...base,
        requestedPaths: ["snapshot"],
        requestedTools: ["list-files"],
        codingWorkerGatePassed: false,
      }),
    ).toThrow(/Coding workers remain disabled/);
  });

  it("assembles only permitted files and scoped memory", () => {
    const assembled = assembleWorkerContext({
      specification: specification(),
      objective: "Inspect.",
      repositoryFiles: [
        { path: "snapshot/README.md", citation: "repository:README.md" },
        { path: "protected/secret.md", citation: "repository:protected/secret.md" },
      ],
      memories: [
        {
          category: "project",
          sensitivity: "internal",
          value: "Allowed",
          citation: "memory:allowed",
        },
        { category: "founder", sensitivity: "secret", value: "Denied", citation: "memory:denied" },
      ],
      constraints: [],
    });
    expect(assembled.repositoryFiles.map((file) => file.path)).toEqual(["snapshot/README.md"]);
    expect(assembled.memories.map((memory) => memory.value)).toEqual(["Allowed"]);
  });

  it("assigns a capable model within the GPU boundary", () => {
    expect(
      assignModel({
        purpose: "repository-inspection",
        maximumGpuVramMiB: 0,
        candidates: [
          {
            provider: "deterministic",
            model: "cartographer",
            capabilities: ["repository-inspection"],
            gpuVramMiB: 0,
            priority: 10,
          },
          {
            provider: "ollama",
            model: "oversized",
            capabilities: ["repository-inspection"],
            gpuVramMiB: 20_000,
            priority: 20,
          },
        ],
      }),
    ).toMatchObject({ model: "cartographer", provider: "deterministic" });
  });

  it("rejects delegation and permission expansion in the worker schema", () => {
    const invalid = structuredClone(specification()) as unknown as Record<string, unknown>;
    (invalid.reasoning as Record<string, unknown>).mayDelegate = true;
    expect(() => workerSpecificationSchema.parse(invalid)).toThrow();
  });
});

describe("Wave 8 Cognitive Process Manager", () => {
  it("runs the read-only lifecycle, collects output, terminates, and verifies cleanup", async () => {
    const { manager, runtime, events } = harness();
    const result = await manager.execute(specification(), context);
    expect(result).toMatchObject({
      status: "succeeded",
      cleanupVerified: true,
      output: { fileCount: 1 },
    });
    expect({
      prepared: runtime.prepared,
      launched: runtime.launched,
      terminated: runtime.terminated,
      cleaned: runtime.cleaned,
    }).toEqual({ prepared: 1, launched: 1, terminated: 1, cleaned: 1 });
    expect(events.map((event) => event.type)).toEqual([
      "WorkerSpecified",
      "WorkerStarted",
      "WorkerOutputCollected",
      "WorkerTerminated",
      "WorkerCleanupVerified",
    ]);
  });

  it("denies a coding worker before workspace creation", async () => {
    const { manager, runtime } = harness();
    const result = await manager.execute(specification({ workerClass: "coding" }), context);
    expect(result.status).toBe("denied");
    expect(runtime.prepared).toBe(0);
  });

  it("denies a revoked worker before launch", async () => {
    const { manager, runtime } = harness();
    manager.revoke("worker_repository-cartographer");
    expect((await manager.execute(specification(), context)).status).toBe("revoked");
    expect(runtime.prepared).toBe(0);
  });

  it("fails reported permission expansion and still cleans up", async () => {
    const runtime = new FixtureRuntime();
    runtime.result = { ...runtime.result, reportedTools: ["write-file"] };
    const { manager } = harness(runtime);
    const result = await manager.execute(specification(), context);
    expect(result).toMatchObject({ status: "failed", cleanupVerified: true });
    expect(runtime.cleaned).toBe(1);
  });

  it("enforces timeout, termination, and cleanup", async () => {
    const runtime = new FixtureRuntime();
    runtime.delayMs = 100;
    const { manager } = harness(runtime);
    const result = await manager.execute(
      specification({ resources: { ...specification().resources, timeoutMs: 10 } }),
      context,
    );
    expect(result).toMatchObject({ status: "timed-out", cleanupVerified: true });
    expect(runtime.terminated).toBe(1);
    expect(runtime.cleaned).toBe(1);
  });

  it("fails closed when cleanup cannot be verified", async () => {
    const runtime = new FixtureRuntime();
    runtime.cleanupResult = false;
    expect(await harness(runtime).manager.execute(specification(), context)).toMatchObject({
      status: "failed",
      cleanupVerified: false,
    });
  });
});
