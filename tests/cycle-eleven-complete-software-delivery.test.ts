import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

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
    return Promise.resolve({ passed: this.verifyCount > 1, checks: ["pnpm test"] });
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
    return Promise.resolve();
  }
  commit() {
    this.calls.push("commit");
    return Promise.resolve({ commit });
  }
  pushBranch() {
    this.calls.push("push");
    return Promise.resolve({ remoteCommit: commit });
  }
  createPullRequest() {
    this.calls.push("pr");
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
    return Promise.resolve({
      mergeable: true,
      approvalStatement: `I approve merging PR 42 at ${commit}.`,
    });
  }
  verifyRemoteEquality() {
    this.calls.push("remote-equality");
    return Promise.resolve(true);
  }
  cleanup() {
    this.calls.push("cleanup");
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
    expect(result.mergeApprovalStatement).toContain("PR 42");
    expect(adapter.calls).toEqual([
      "inspect",
      "plan",
      "workspace",
      "implement",
      "verify",
      "repair",
      "implement",
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
});
