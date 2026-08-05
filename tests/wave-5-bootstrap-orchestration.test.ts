import { describe, expect, it } from "vitest";

import {
  BootstrapOrchestrator,
  DisabledExecutorAdapter,
  OpenClawAdapter,
  approvedOpenClawRuntime,
  type ExecutionRequest,
  type ExecutorAdapter,
  type ExecutorResult,
  type OrchestrationLifecycleEvent,
} from "../packages/orchestration/src/index.js";

const request: ExecutionRequest = {
  requestId: "request_01936f3a-8b5c-7def-8abc-0123456789ab",
  correlation: { correlationId: "request_01936f3a-8b5c-7def-8abc-0123456789ab" },
  requestedBy: {
    actorId: "worker_01936f3a-8b5c-7def-8abc-0123456789ab",
    actorType: "iris-core",
    displayName: "IRIS Kernel",
  },
  objective: "Read a fictional task input and return its line count.",
  idempotencyKey: "wave5-fictional-task-1",
  workspace: "tasks/fictional-1",
  permittedTools: ["read-file"],
  permittedPaths: ["tasks/fictional-1/input.txt"],
  timeoutMs: 100,
  network: "none",
  browser: false,
  elevated: false,
  dockerSocket: false,
  canonicalRepositoryMounted: false,
  syntheticDataOnly: true,
  input: { file: "input.txt" },
};

class FixtureAdapter implements ExecutorAdapter {
  readonly provider = "fixture";
  readonly version = "1.0.0";
  executions = 0;
  cancellations = 0;
  result: ExecutorResult = {
    status: "succeeded",
    output: { lineCount: 3 },
    actions: [
      {
        tool: "read-file",
        target: "tasks/fictional-1/input.txt",
        outcome: "succeeded",
        summary: "Read synthetic input.",
      },
    ],
    safeSummary: "Synthetic input inspected.",
  };

  health() {
    return Promise.resolve({ status: "ready" as const, safeSummary: "Fixture ready." });
  }

  execute(_request: ExecutionRequest, _signal: AbortSignal) {
    void _request;
    void _signal;
    this.executions += 1;
    return Promise.resolve(this.result);
  }

  cancel(_requestId: string) {
    void _requestId;
    this.cancellations += 1;
    return Promise.resolve();
  }
}

function harness(adapter: ExecutorAdapter = new FixtureAdapter()) {
  const lifecycle: OrchestrationLifecycleEvent[] = [];
  const orchestrator = new BootstrapOrchestrator({
    adapter,
    gatewayToken: "fictional-gateway-token-2026",
    allowedTools: ["read-file", "list-files"],
    allowedWorkspacePrefix: "tasks",
    now: () => "2026-08-05T12:00:00-06:00",
    publishLifecycle: (event) => {
      lifecycle.push(event);
      return Promise.resolve();
    },
  });
  return { orchestrator, lifecycle };
}

describe("Wave 5 bootstrap orchestration adapter", () => {
  it("executes an authenticated bounded task and records every reported action", async () => {
    const { orchestrator, lifecycle } = harness();
    const result = await orchestrator.execute("fictional-gateway-token-2026", request);
    expect(result).toMatchObject({ status: "succeeded", provider: "fixture" });
    expect(result.actions).toEqual([
      expect.objectContaining({ tool: "read-file", target: "tasks/fictional-1/input.txt" }),
    ]);
    expect(lifecycle.map((event) => event.type)).toEqual([
      "ExecutionStarted",
      "ExecutionCompleted",
    ]);
    expect(orchestrator.verifyAuditChain()).toBe(true);
  });

  it("rejects invalid gateway authentication before provider execution", async () => {
    const adapter = new FixtureAdapter();
    const { orchestrator } = harness(adapter);
    const result = await orchestrator.execute("wrong-token", request);
    expect(result.status).toBe("denied");
    expect(adapter.executions).toBe(0);
    expect(orchestrator.audit()[0]?.type).toBe("ExecutionDenied");
    const authenticatedRetry = await orchestrator.execute("fictional-gateway-token-2026", request);
    expect(authenticatedRetry.status).toBe("succeeded");
    expect(adapter.executions).toBe(1);
  });

  it("denies unapproved tools and paths without invoking the provider", async () => {
    const adapter = new FixtureAdapter();
    const { orchestrator } = harness(adapter);
    const toolResult = await orchestrator.execute("fictional-gateway-token-2026", {
      ...request,
      idempotencyKey: "unapproved-tool",
      permittedTools: ["shell"],
    });
    const pathResult = await orchestrator.execute("fictional-gateway-token-2026", {
      ...request,
      idempotencyKey: "unapproved-path",
      permittedPaths: ["other/repository/secret.txt"],
    });
    expect([toolResult.status, pathResult.status]).toEqual(["denied", "denied"]);
    expect(adapter.executions).toBe(0);
  });

  it("rejects provider privilege expansion and cancels the request", async () => {
    const adapter = new FixtureAdapter();
    adapter.result = {
      ...adapter.result,
      actions: [
        {
          tool: "shell",
          target: "tasks/fictional-1/input.txt",
          outcome: "succeeded",
          summary: "Attempted unapproved shell action.",
        },
      ],
    };
    const { orchestrator } = harness(adapter);
    const result = await orchestrator.execute("fictional-gateway-token-2026", request);
    expect(result.status).toBe("denied");
    expect(adapter.cancellations).toBe(1);
  });

  it("terminates a provider at the IRIS timeout boundary", async () => {
    const adapter = new FixtureAdapter();
    adapter.execute = (_input, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
    const { orchestrator } = harness(adapter);
    const result = await orchestrator.execute("fictional-gateway-token-2026", {
      ...request,
      timeoutMs: 10,
    });
    expect(result.status).toBe("timed-out");
    expect(adapter.cancellations).toBe(1);
  });

  it("suppresses repeated execution by idempotency key", async () => {
    const adapter = new FixtureAdapter();
    const { orchestrator } = harness(adapter);
    await orchestrator.execute("fictional-gateway-token-2026", request);
    const repeated = await orchestrator.execute("fictional-gateway-token-2026", request);
    expect(repeated.status).toBe("duplicate");
    expect(adapter.executions).toBe(1);
  });

  it("preserves IRIS contract behavior when the external provider is removed", async () => {
    const { orchestrator } = harness(new DisabledExecutorAdapter());
    const result = await orchestrator.execute("fictional-gateway-token-2026", request);
    expect(result).toMatchObject({
      status: "failed",
      provider: "iris-native-disabled-provider",
      safeSummary: "Execution provider is unavailable.",
    });
    expect(orchestrator.verifyAuditChain()).toBe(true);
  });

  it("pins the approved OpenClaw identity behind a replaceable transport", async () => {
    let cancelled = false;
    const adapter = new OpenClawAdapter({
      health: () => Promise.resolve(true),
      execute: () =>
        Promise.resolve({
          status: "succeeded",
          output: { bounded: true },
          actions: [],
          safeSummary: "Bounded transport proof.",
        }),
      cancel: () => {
        cancelled = true;
        return Promise.resolve();
      },
    });
    expect(await adapter.health()).toMatchObject({ status: "ready" });
    await adapter.cancel(request.requestId);
    expect(cancelled).toBe(true);
    expect(approvedOpenClawRuntime).toEqual({
      image: "ghcr.io/openclaw/openclaw:2026.7.1-2",
      digest: "sha256:8789721d2e9b24b780a1504b56deb4c6bd5c7dbf96a1dd117e7c45c2ed72c8ac",
      sourceRevision: "0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c",
      license: "MIT",
    });
  });
});
