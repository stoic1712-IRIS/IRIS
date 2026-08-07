import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  CompleteSoftwareDeliveryRuntime,
  MemoryCompleteDeliveryStore,
  type CompleteDeliveryAdapter,
  type CompleteDeliveryObjective,
} from "../packages/development/src/index.js";

const now = new Date("2026-08-07T14:30:00.000Z");
const commit = "a".repeat(40);
const digest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function objective(overrides: Partial<CompleteDeliveryObjective> = {}): CompleteDeliveryObjective {
  return {
    deliveryId: "delivery_cycle-eleven-0001",
    accessRequestId: "access_founder-full-0001",
    repository: "stoic1712-IRIS/IRIS",
    baseRevision: "b".repeat(40),
    branch: "iris/candidate/cycle-eleven-test",
    objective: "Implement and verify one bounded software-delivery increment.",
    readPaths: ["packages/example"],
    writePaths: ["packages/example/src"],
    verificationCommands: [["pnpm", "test"]],
    maximumRepairAttempts: 2,
    maximumChangedFiles: 3,
    maximumChangedBytes: 10_000,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
    budgetUsd: 0,
    ...overrides,
  };
}

class FixtureDeliveryAdapter implements CompleteDeliveryAdapter {
  calls: string[] = [];
  verifyCount = 0;
  reviewCount = 0;
  selfReview = false;
  changedPath = "packages/example/src/value.ts";
  repairChangedPath: string | undefined;
  verificationChecks = [["pnpm", "test"]];
  remoteEqualityCount = 0;
  failRemoteEqualityOnce = false;
  failCommitAfterMutationOnce = false;
  commitFailureUsed = false;
  hangCleanup = false;
  providerMutations = new Set<string>();

  inspect() {
    this.calls.push("inspect");
    return Promise.resolve({ contextDigest: digest("context") });
  }
  plan() {
    this.calls.push("plan");
    return Promise.resolve({ planDigest: digest("plan"), workerId: "worker_coder" });
  }
  createWorkspace() {
    this.calls.push("workspace");
    return Promise.resolve({ workspaceId: "workspace_disposable" });
  }
  implement() {
    this.calls.push("implement");
    return Promise.resolve({ changedPaths: [this.changedPath], changedBytes: 40 });
  }
  verify() {
    this.calls.push("verify");
    this.verifyCount += 1;
    return Promise.resolve({ passed: this.verifyCount > 1, checks: this.verificationChecks });
  }
  review() {
    this.calls.push("review");
    this.reviewCount += 1;
    return Promise.resolve({
      reviewerId: this.selfReview ? "worker_coder" : "reviewer_independent",
      verdict: "pass" as const,
      findings: [],
    });
  }
  repair() {
    this.calls.push("repair");
    return Promise.resolve({
      changedPaths: [this.repairChangedPath ?? this.changedPath],
      changedBytes: 40,
    });
  }
  commit(_objective: unknown, _workspaceId: string, idempotencyKey: string) {
    this.calls.push("commit");
    this.providerMutations.add(`commit:${idempotencyKey}`);
    if (this.failCommitAfterMutationOnce && !this.commitFailureUsed) {
      this.commitFailureUsed = true;
      throw new Error("SIMULATED_CRASH_AFTER_COMMIT");
    }
    return Promise.resolve({ commit });
  }
  pushBranch(_objective: unknown, _workspaceId: string, _commit: string, idempotencyKey: string) {
    this.calls.push("push");
    this.providerMutations.add(`push:${idempotencyKey}`);
    return Promise.resolve({ remoteCommit: commit });
  }
  createPullRequest(_objective: unknown, _commit: string, idempotencyKey: string) {
    this.calls.push("pr");
    this.providerMutations.add(`pr:${idempotencyKey}`);
    return Promise.resolve({
      number: 42,
      url: "https://example.invalid/pr/42",
      headCommit: commit,
    });
  }
  monitorCi() {
    this.calls.push("ci");
    return Promise.resolve({ conclusion: "success" as const, checks: ["verify"] });
  }
  addressReview() {
    this.calls.push("address-review");
    return Promise.resolve({ changed: false });
  }
  prepareMerge() {
    this.calls.push("prepare-merge");
    return Promise.resolve({ mergeable: true });
  }
  verifyRemoteEquality() {
    this.calls.push("remote-equality");
    this.remoteEqualityCount += 1;
    return Promise.resolve(!this.failRemoteEqualityOnce || this.remoteEqualityCount > 1);
  }
  cleanup() {
    this.calls.push("cleanup");
    if (this.hangCleanup) return new Promise<boolean>(() => undefined);
    return Promise.resolve(true);
  }
}

const access = { authorize: () => ({}) };

describe("Cycle Eleven complete software delivery", () => {
  it("completes the ordinary path and stops before protected merge", async () => {
    const adapter = new FixtureDeliveryAdapter();
    const runtime = new CompleteSoftwareDeliveryRuntime({
      access,
      adapter,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    });
    const result = await runtime.start(objective());
    expect(result.state).toBe("ready-for-merge-approval");
    expect(result.repairAttempt).toBe(1);
    expect(result.remoteEqualityVerified).toBe(true);
    expect(result.cleanupVerified).toBe(true);
    expect(result.mergeApprovalStatement).toBe(
      `I approve merging pull request 42 in stoic1712-IRIS/IRIS at ${commit} into main.`,
    );
    expect(adapter.calls).toEqual([
      "inspect",
      "plan",
      "workspace",
      "implement",
      "verify",
      "repair",
      "verify",
      "review",
      "commit",
      "push",
      "pr",
      "ci",
      "address-review",
      "prepare-merge",
      "remote-equality",
      "cleanup",
    ]);
    expect(result.events.at(-1)?.state).toBe("ready-for-merge-approval");
  });

  it("denies self-review and preserves a resumable workspace", async () => {
    const adapter = new FixtureDeliveryAdapter();
    adapter.verifyCount = 1;
    adapter.selfReview = true;
    const runtime = new CompleteSoftwareDeliveryRuntime({
      access,
      adapter,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    });
    const result = await runtime.start(objective());
    expect(result.state).toBe("recovery-ready");
    expect(result.summary).toBe("DELIVERY_SELF_REVIEW_DENIED");
    expect(adapter.calls).not.toContain("push");
  });

  it("pauses, resumes under the unchanged grant, and rejects scope widening", async () => {
    const adapter = new FixtureDeliveryAdapter();
    adapter.verifyCount = 1;
    const store = new MemoryCompleteDeliveryStore();
    const runtime = new CompleteSoftwareDeliveryRuntime({ access, adapter, store, now: () => now });
    const controller = new AbortController();
    controller.abort();
    const paused = await runtime.start(objective(), controller.signal);
    expect(paused.state).toBe("paused");
    expect((await runtime.resume(paused.objective.deliveryId)).state).toBe(
      "ready-for-merge-approval",
    );

    const widened = new FixtureDeliveryAdapter();
    widened.verifyCount = 1;
    widened.changedPath = "outside/value.ts";
    const denied = await new CompleteSoftwareDeliveryRuntime({
      access,
      adapter: widened,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    }).start(objective({ deliveryId: "delivery_cycle-eleven-0002" }));
    expect(denied.state).toBe("recovery-ready");
    expect(denied.summary).toContain("DELIVERY_CHANGED_PATH_DENIED");
  });

  it("does not duplicate commit, push, or pull-request effects after resume", async () => {
    const adapter = new FixtureDeliveryAdapter();
    adapter.verifyCount = 1;
    adapter.failRemoteEqualityOnce = true;
    const store = new MemoryCompleteDeliveryStore();
    const runtime = new CompleteSoftwareDeliveryRuntime({ access, adapter, store, now: () => now });
    const first = await runtime.start(objective({ deliveryId: "delivery_cycle-eleven-0003" }));
    expect(first.state).toBe("recovery-ready");
    const resumed = await runtime.resume(first.objective.deliveryId);
    expect(resumed.state).toBe("ready-for-merge-approval");
    expect(adapter.calls.filter((call) => call === "commit")).toHaveLength(1);
    expect(adapter.calls.filter((call) => call === "push")).toHaveLength(1);
    expect(adapter.calls.filter((call) => call === "pr")).toHaveLength(1);
  });

  it("keeps cancellation terminal when an in-flight adapter returns late", async () => {
    let finishImplementation: (() => void) | undefined;
    class DeferredAdapter extends FixtureDeliveryAdapter {
      override implement() {
        this.calls.push("implement");
        return new Promise<{ changedPaths: string[]; changedBytes: number }>((resolve) => {
          finishImplementation = () => {
            resolve({ changedPaths: [this.changedPath], changedBytes: 40 });
          };
        });
      }
    }
    const adapter = new DeferredAdapter();
    const runtime = new CompleteSoftwareDeliveryRuntime({
      access,
      adapter,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    });
    const running = runtime.start(objective({ deliveryId: "delivery_cycle-eleven-0004" }));
    await vi.waitFor(() => {
      expect(adapter.calls).toContain("implement");
    });
    const cancelled = await runtime.cancel("delivery_cycle-eleven-0004");
    finishImplementation?.();
    expect(cancelled.state).toBe("cancelled");
    expect((await running).state).toBe("cancelled");
    expect((await runtime.session("delivery_cycle-eleven-0004"))?.state).toBe("cancelled");
  });

  it("reauthorizes immediately before every provider effect", async () => {
    const adapter = new FixtureDeliveryAdapter();
    let authorizations = 0;
    const runtime = new CompleteSoftwareDeliveryRuntime({
      access: {
        authorize: () => {
          authorizations += 1;
          if (authorizations > 13) throw new Error("FOUNDER_ACCESS_REVOKED");
          return {};
        },
      },
      adapter,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    });
    const result = await runtime.start(objective({ deliveryId: "delivery_cycle-eleven-0005" }));
    expect(result.state).toBe("recovery-ready");
    expect(result.summary).toBe("FOUNDER_ACCESS_REVOKED");
    expect(adapter.calls).toEqual(["inspect", "plan", "workspace"]);
  });

  it("revalidates repair scope and exact verification commands", async () => {
    const scoped = new FixtureDeliveryAdapter();
    scoped.repairChangedPath = "outside/repair.ts";
    const deniedRepair = await new CompleteSoftwareDeliveryRuntime({
      access,
      adapter: scoped,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    }).start(objective({ deliveryId: "delivery_cycle-eleven-0006" }));
    expect(deniedRepair.state).toBe("recovery-ready");
    expect(deniedRepair.summary).toBe("DELIVERY_CHANGED_PATH_DENIED:outside/repair.ts");
    expect(scoped.calls).not.toContain("commit");

    const wrongChecks = new FixtureDeliveryAdapter();
    wrongChecks.verifyCount = 1;
    wrongChecks.verificationChecks = [["pnpm", "lint"]];
    const deniedChecks = await new CompleteSoftwareDeliveryRuntime({
      access,
      adapter: wrongChecks,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    }).start(objective({ deliveryId: "delivery_cycle-eleven-0007" }));
    expect(deniedChecks.state).toBe("recovery-ready");
    expect(deniedChecks.summary).toBe("DELIVERY_VERIFICATION_COMMAND_MISMATCH");
    expect(wrongChecks.calls).not.toContain("commit");
  });

  it("reconciles crash-window mutations with persisted idempotency keys", async () => {
    const adapter = new FixtureDeliveryAdapter();
    adapter.verifyCount = 1;
    adapter.failCommitAfterMutationOnce = true;
    const runtime = new CompleteSoftwareDeliveryRuntime({
      access,
      adapter,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
    });
    const first = await runtime.start(objective({ deliveryId: "delivery_cycle-eleven-0008" }));
    expect(first.state).toBe("recovery-ready");
    expect(first.summary).toBe("SIMULATED_CRASH_AFTER_COMMIT");
    const resumed = await runtime.resume(first.objective.deliveryId);
    expect(resumed.state).toBe("ready-for-merge-approval");
    expect(adapter.calls.filter((call) => call === "commit")).toHaveLength(2);
    expect(
      [...adapter.providerMutations].filter((item) => item.startsWith("commit:")),
    ).toHaveLength(1);
    expect([...adapter.providerMutations].filter((item) => item.startsWith("push:"))).toHaveLength(
      1,
    );
    expect([...adapter.providerMutations].filter((item) => item.startsWith("pr:"))).toHaveLength(1);
  });

  it("persists terminal cancellation before bounded cleanup can stall", async () => {
    let finishImplementation: (() => void) | undefined;
    class DeferredAdapter extends FixtureDeliveryAdapter {
      override implement() {
        this.calls.push("implement");
        return new Promise<{ changedPaths: string[]; changedBytes: number }>((resolve) => {
          finishImplementation = () => {
            resolve({ changedPaths: [this.changedPath], changedBytes: 40 });
          };
        });
      }
    }
    const adapter = new DeferredAdapter();
    adapter.hangCleanup = true;
    const runtime = new CompleteSoftwareDeliveryRuntime({
      access,
      adapter,
      store: new MemoryCompleteDeliveryStore(),
      now: () => now,
      terminationTimeoutMs: 10,
    });
    const running = runtime.start(objective({ deliveryId: "delivery_cycle-eleven-0009" }));
    await vi.waitFor(() => {
      expect(adapter.calls).toContain("implement");
    });
    const cancelled = await runtime.cancel("delivery_cycle-eleven-0009");
    finishImplementation?.();
    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.summary).toContain("DELIVERY_TERMINATION_TIMEOUT");
    expect((await running).state).toBe("cancelled");
  });
});
