import { describe, expect, it, vi } from "vitest";

import {
  MemoryOperatorSessionStore,
  OperatorParityRuntime,
  type OperatorExecutionAdapter,
  type OperatorObjective,
} from "../packages/development/src/index.js";

const now = new Date("2026-08-07T14:40:00.000Z");

function objective(overrides: Partial<OperatorObjective> = {}): OperatorObjective {
  return {
    operatorId: "operator_cycle-twelve-0001",
    accessRequestId: "access_founder-full-0001",
    objective: "Complete one bounded held-out repository implementation task.",
    category: "software-delivery",
    requiredCapabilities: ["repository.inspect", "repository.edit-bounded"],
    protectedEffects: [],
    maximumAttempts: 2,
    timeoutMs: 60_000,
    budgetUsd: 0,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
    presentGraduationProposal: false,
    ...overrides,
  };
}

class FixtureOperatorAdapter implements OperatorExecutionAdapter {
  calls: string[] = [];
  verifyCount = 0;
  protectedResult = false;
  run() {
    this.calls.push("run");
    return Promise.resolve({
      summary: "Bounded implementation completed.",
      evidence: ["tests passed", "remote equality verified"],
      requiresProtectedAction: this.protectedResult,
    });
  }
  verify(_objective: unknown, plan: { reviewerId: string }) {
    this.calls.push("verify");
    this.verifyCount += 1;
    return Promise.resolve({
      reviewerId: plan.reviewerId,
      passed: this.verifyCount > 1,
      findings: this.verifyCount > 1 ? [] : ["Repair the held-out fixture."],
    });
  }
  repair() {
    this.calls.push("repair");
    return Promise.resolve();
  }
  cancel() {
    this.calls.push("cancel");
    return Promise.resolve();
  }
}

function runtime(
  adapter = new FixtureOperatorAdapter(),
  access: { authorize(requestId: string, capability: string): unknown } = {
    authorize: () => ({}),
  },
  maximumEffectTimeoutMs?: number,
) {
  return new OperatorParityRuntime({
    access,
    adapter,
    store: new MemoryOperatorSessionStore(),
    models: [
      {
        model: "qwen3-coder:30b",
        capabilities: ["repository.inspect", "repository.edit-bounded"],
        approved: true,
        local: true,
      },
    ],
    tools: ["repository.inspect", "repository.edit-bounded"],
    now: () => now,
    ...(maximumEffectTimeoutMs === undefined ? {} : { maximumEffectTimeoutMs }),
  });
}

describe("Cycle Twelve operator parity runtime", () => {
  it("routes, repairs, independently verifies, and completes with an evidence chain", async () => {
    const adapter = new FixtureOperatorAdapter();
    const result = await runtime(adapter).start(objective());
    expect(result.state).toBe("completed");
    expect(result.plan?.model).toBe("qwen3-coder:30b");
    expect(result.attempt).toBe(2);
    expect(result.outcome?.evidence).toContain("tests passed");
    expect(adapter.calls).toEqual(["run", "verify", "repair", "run", "verify"]);
    expect(result.events.at(-1)?.state).toBe("completed");
  });

  it("stops before an explicitly protected objective without calling a provider", async () => {
    const adapter = new FixtureOperatorAdapter();
    const result = await runtime(adapter).start(
      objective({
        operatorId: "operator_cycle-twelve-0002",
        protectedEffects: ["deployment", "credentials"],
      }),
    );
    expect(result.state).toBe("protected-stop");
    expect(result.protectedApprovalStatement).toContain("deployment, credentials");
    expect(adapter.calls).toEqual([]);
  });

  it("presents the exact graduation statement but never submits it", async () => {
    const adapter = new FixtureOperatorAdapter();
    adapter.verifyCount = 1;
    const result = await runtime(adapter).start(
      objective({
        operatorId: "operator_cycle-twelve-0003",
        presentGraduationProposal: true,
      }),
    );
    expect(result.state).toBe("completed");
    expect(result.graduationApprovalStatement).toMatch(
      /^I approve proposal_phase-0-graduation at sha256:[a-f0-9]{64} for IRIS execution exactly as proposed\.$/u,
    );
    expect(adapter.calls).toEqual(["run", "verify"]);
  });

  it("pauses, resumes, rejects terminal cancellation, and fails closed for missing capabilities", async () => {
    const adapter = new FixtureOperatorAdapter();
    adapter.verifyCount = 1;
    const sessionRuntime = runtime(adapter);
    const controller = new AbortController();
    controller.abort();
    const paused = await sessionRuntime.start(
      objective({ operatorId: "operator_cycle-twelve-0004" }),
      controller.signal,
    );
    expect(paused.state).toBe("paused");
    expect((await sessionRuntime.resume(paused.objective.operatorId)).state).toBe("completed");
    await expect(sessionRuntime.cancel(paused.objective.operatorId)).rejects.toThrow(
      "OPERATOR_TERMINAL",
    );

    const denied = await runtime().start(
      objective({
        operatorId: "operator_cycle-twelve-0005",
        requiredCapabilities: ["desktop.control-unregistered"],
      }),
    );
    expect(denied.state).toBe("denied");
    expect(denied.summary).toContain("OPERATOR_CAPABILITY_UNAVAILABLE");
  });

  it("enforces a real timeout even when an adapter ignores its abort signal", async () => {
    class HangingAdapter extends FixtureOperatorAdapter {
      override run() {
        this.calls.push("run");
        return new Promise<never>(() => undefined);
      }
    }
    const adapter = new HangingAdapter();
    const result = await runtime(adapter, undefined, 10).start(
      objective({ operatorId: "operator_cycle-twelve-0006" }),
    );
    expect(result.state).toBe("recovery-ready");
    expect(result.summary).toBe("OPERATOR_EFFECT_TIMEOUT");
  });

  it("keeps cancellation terminal when an in-flight provider returns late", async () => {
    let finishRun: (() => void) | undefined;
    class DeferredAdapter extends FixtureOperatorAdapter {
      override run() {
        this.calls.push("run");
        return new Promise<{
          summary: string;
          evidence: string[];
          requiresProtectedAction: boolean;
        }>((resolve) => {
          finishRun = () => {
            resolve({
              summary: "Late result.",
              evidence: ["late"],
              requiresProtectedAction: false,
            });
          };
        });
      }
    }
    const adapter = new DeferredAdapter();
    const sessionRuntime = runtime(adapter);
    const running = sessionRuntime.start(objective({ operatorId: "operator_cycle-twelve-0007" }));
    await vi.waitFor(() => {
      expect(adapter.calls).toContain("run");
    });
    const cancelled = await sessionRuntime.cancel("operator_cycle-twelve-0007");
    finishRun?.();
    expect(cancelled.state).toBe("cancelled");
    expect((await running).state).toBe("cancelled");
    expect((await sessionRuntime.session("operator_cycle-twelve-0007"))?.state).toBe("cancelled");
  });

  it("reauthorizes every capability immediately before each provider effect", async () => {
    const adapter = new FixtureOperatorAdapter();
    let authorizations = 0;
    const result = await runtime(adapter, {
      authorize: () => {
        authorizations += 1;
        if (authorizations > 2) throw new Error("FOUNDER_ACCESS_REVOKED");
        return {};
      },
    }).start(objective({ operatorId: "operator_cycle-twelve-0008" }));
    expect(result.state).toBe("recovery-ready");
    expect(result.summary).toBe("FOUNDER_ACCESS_REVOKED");
    expect(adapter.calls).toEqual([]);
  });

  it("persists cancellation before a bounded non-cooperative provider stop", async () => {
    class NonCooperativeAdapter extends FixtureOperatorAdapter {
      override run() {
        this.calls.push("run");
        return new Promise<never>(() => undefined);
      }
      override cancel() {
        this.calls.push("cancel");
        return new Promise<never>(() => undefined);
      }
    }
    const adapter = new NonCooperativeAdapter();
    const sessionRuntime = runtime(adapter, undefined, 500);
    const running = sessionRuntime.start(objective({ operatorId: "operator_cycle-twelve-0009" }));
    await vi.waitFor(() => {
      expect(adapter.calls).toContain("run");
    });
    const cancelled = await sessionRuntime.cancel("operator_cycle-twelve-0009");
    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.summary).toContain("OPERATOR_CANCELLATION_TIMEOUT");
    expect((await running).state).toBe("cancelled");
  });
});
