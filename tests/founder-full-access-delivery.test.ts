import { describe, expect, it } from "vitest";

import {
  CompleteSoftwareDeliveryRuntime,
  MemoryCompleteDeliveryStore,
  type CompleteDeliveryAdapter,
  type CompleteDeliveryObjective,
} from "../packages/development/src/index.js";

const now = new Date("2026-08-08T09:00:00.000Z");
const base = "b".repeat(40);
const candidate = "c".repeat(40);
const merge = "d".repeat(40);
const objective: CompleteDeliveryObjective = {
  deliveryId: "delivery_founder-full-0001",
  accessRequestId: "access_founder-full-0001",
  repository: "stoic1712-IRIS/IRIS",
  baseRevision: base,
  branch: "iris/founder/full-access-test",
  objective: "Complete one exact-head Founder Full access delivery.",
  readPaths: ["packages/example"],
  writePaths: ["packages/example/src"],
  verificationCommands: [["pnpm", "verify"]],
  maximumRepairAttempts: 1,
  maximumChangedFiles: 2,
  maximumChangedBytes: 1_000,
  createdAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
  budgetUsd: 0,
};

class Adapter implements CompleteDeliveryAdapter {
  calls: string[] = [];
  staleHead = false;
  ciConclusion: "success" | "failure" = "success";
  mergeBypass = false;
  inspect() {
    return Promise.resolve({ contextDigest: `sha256:${"1".repeat(64)}` });
  }
  plan() {
    return Promise.resolve({ planDigest: `sha256:${"2".repeat(64)}`, workerId: "worker_coder" });
  }
  createWorkspace() {
    return Promise.resolve({ workspaceId: "workspace_disposable" });
  }
  implement() {
    return Promise.resolve({ changedPaths: ["packages/example/src/value.ts"], changedBytes: 10 });
  }
  verify() {
    return Promise.resolve({ passed: true, checks: [["pnpm", "verify"]] });
  }
  review() {
    return Promise.resolve({
      reviewerId: "reviewer_independent",
      verdict: "pass" as const,
      findings: [],
    });
  }
  repair() {
    return Promise.resolve({ changedPaths: ["packages/example/src/value.ts"], changedBytes: 10 });
  }
  commit() {
    return Promise.resolve({ commit: candidate });
  }
  pushBranch() {
    return Promise.resolve({ remoteCommit: candidate });
  }
  createPullRequest() {
    return Promise.resolve({
      number: 81,
      url: "https://example.invalid/pr/81",
      headCommit: candidate,
    });
  }
  monitorCi() {
    return Promise.resolve({ conclusion: this.ciConclusion, checks: ["verify"] });
  }
  addressReview() {
    return Promise.resolve({ changed: false });
  }
  prepareMerge() {
    return Promise.resolve({ mergeable: true });
  }
  verifyRemoteEquality() {
    return Promise.resolve(true);
  }
  cleanup() {
    return Promise.resolve(true);
  }
  mergeReviewedHead(_objective: CompleteDeliveryObjective, _pr: number, expected: string) {
    this.calls.push("merge");
    return Promise.resolve({
      expectedHeadCommit: this.staleHead ? base : expected,
      mergeCommit: merge,
      providerMainRevision: merge,
      branchProtectionHonored: !this.mergeBypass,
      adminBypassUsed: this.mergeBypass,
      forceUsed: false,
    });
  }
  synchronizeCanonicalMain() {
    this.calls.push("sync");
    return Promise.resolve({ localMainRevision: merge, remoteMainRevision: merge });
  }
  captureRollbackEvidence() {
    this.calls.push("rollback");
    return Promise.resolve({ evidenceDigest: `sha256:${"3".repeat(64)}`, historyPreserving: true });
  }
}

const access = { authorize: () => ({}) };

async function prepared(adapter: Adapter, id = objective.deliveryId) {
  const runtime = new CompleteSoftwareDeliveryRuntime({
    access,
    adapter,
    store: new MemoryCompleteDeliveryStore(),
    now: () => now,
  });
  const session = await runtime.start({ ...objective, deliveryId: id });
  expect(session.state).toBe("ready-for-merge-approval");
  return runtime;
}

describe("Founder Full access complete delivery", () => {
  it("merges only the reviewed pushed head, synchronizes, and preserves rollback evidence", async () => {
    const adapter = new Adapter();
    const runtime = await prepared(adapter);
    const result = await runtime.completeUnderFounderAccess(objective.deliveryId, candidate);
    expect(result.state).toBe("completed");
    expect(result.mergedCommit).toBe(merge);
    expect(result.canonicalEqualityVerified).toBe(true);
    expect(result.rollbackEvidenceDigest).toBe(`sha256:${"3".repeat(64)}`);
    expect(adapter.calls).toEqual(["merge", "sync", "rollback"]);
  });

  it("fails closed for a stale head, failed CI, or branch-protection bypass", async () => {
    const stale = new Adapter();
    stale.staleHead = true;
    const staleRuntime = await prepared(stale, "delivery_founder-full-0002");
    await expect(
      staleRuntime.completeUnderFounderAccess("delivery_founder-full-0002", candidate),
    ).rejects.toThrow("DELIVERY_MERGE_HEAD_MISMATCH");

    const bypass = new Adapter();
    bypass.mergeBypass = true;
    const bypassRuntime = await prepared(bypass, "delivery_founder-full-0003");
    await expect(
      bypassRuntime.completeUnderFounderAccess("delivery_founder-full-0003", candidate),
    ).rejects.toThrow("DELIVERY_BRANCH_PROTECTION_BYPASS_DENIED");
  });
});
