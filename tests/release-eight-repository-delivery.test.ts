import { describe, expect, it } from "vitest";
import {
  bindRepositoryDeliveryCode,
  createRepositoryDeliveryProposal,
  executeRepositoryDelivery,
  repositoryDeliveryProposalSchema,
  type RepositoryDeliveryAdapter,
} from "../packages/kernel/src/index.js";

const revision = "a".repeat(40);
const repairResult = {
  verdict: "verified" as const,
  summary: "Verified fictional two-file candidate.",
  repository: "stoic1712-IRIS/IRIS" as const,
  baseRevision: revision,
  candidateId: "candidate_release-seven-aaaaaaaaaaaa",
  diffDigest: `sha256:${"b".repeat(64)}`,
  changedFiles: [
    {
      path: "README.md",
      beforeDigest: `sha256:${"c".repeat(64)}`,
      afterDigest: `sha256:${"d".repeat(64)}`,
    },
  ],
  diff: "diff --git a/README.md b/README.md\n",
  verification: [
    {
      command: "unit-and-integration-tests" as const,
      state: "passed" as const,
      exitCode: 0,
      durationMs: 1,
      output: "passed",
    },
  ],
  canonicalRepositoryChanged: false as const,
  githubChanged: false as const,
  cleanupState: "completed" as const,
  expiresAt: "2026-08-06T00:00:00.000Z",
};

function proposal() {
  return createRepositoryDeliveryProposal(
    {
      repository: "stoic1712-IRIS/IRIS",
      baseRevision: revision,
      expectedLocalMainRevision: revision,
      expectedRemoteMainRevision: revision,
      repairResult,
    },
    new Date("2026-08-05T23:00:00.000Z"),
  );
}

function adapter(events: string[], failAt?: string): RepositoryDeliveryAdapter {
  const step = (name: string, value?: string): Promise<string> => {
    events.push(name);
    if (failAt === name) return Promise.reject(new Error("FICTIONAL_PROVIDER_FAILURE"));
    return Promise.resolve(value ?? "");
  };
  return {
    preflight: () => step("preflight").then(() => undefined),
    reconstructAndVerify: (p) => step("verify", p.repairResult.diffDigest),
    createCommit: () => step("commit", "e".repeat(40)),
    pushCheckpoint: (_p, commit) => step("checkpoint", commit),
    pushTarget: (_p, commit) => step("target", commit),
    createDraftPullRequest: async () => {
      await step("draft-pr");
      return { number: 42, url: "https://github.com/example/repo/pull/42", draft: true };
    },
    cleanup: () => step("cleanup").then(() => undefined),
    clearCredential: () => events.push("credential-cleared"),
  };
}

function activation(p = proposal()) {
  const code = "12345678";
  const bindingSecret = "founder-session-secret";
  return {
    proposal: p,
    statement: p.approvalStatement,
    code,
    expectedCodeBinding: bindRepositoryDeliveryCode(bindingSecret, p, code),
    bindingSecret,
    approvalState: { consumed: false },
    now: new Date("2026-08-05T23:00:30.000Z"),
  };
}

describe("Release Eight governed repository delivery", () => {
  it("derives deterministic unique checkpoint, branch, commit, and draft PR fields", () => {
    expect(proposal()).toEqual(proposal());
    expect(proposal().checkpointRef).toMatch(/^checkpoint\/release-eight-[a-f0-9]{12}$/u);
    expect(proposal().targetBranch).toMatch(/^iris\/delivery-[a-f0-9]{12}$/u);
    expect(proposal().pullRequestDraft).toBe(true);
    expect(proposal().mergeAuthority).toBe(false);
  });

  it("rejects stale or unverified Release Seven evidence", () => {
    expect(() =>
      createRepositoryDeliveryProposal({
        repository: "stoic1712-IRIS/IRIS",
        baseRevision: revision,
        expectedLocalMainRevision: "f".repeat(40),
        expectedRemoteMainRevision: revision,
        repairResult,
      }),
    ).toThrow("DELIVERY_BASE_DENIED");
    expect(() =>
      createRepositoryDeliveryProposal({
        repository: "stoic1712-IRIS/IRIS",
        baseRevision: revision,
        expectedLocalMainRevision: revision,
        expectedRemoteMainRevision: revision,
        repairResult: { ...repairResult, verdict: "needs-repair" },
      }),
    ).toThrow("DELIVERY_CANDIDATE_DENIED");
  });

  it("binds exact approval and excludes unexpected authority fields", () => {
    const p = proposal();
    expect(bindRepositoryDeliveryCode("secret", p, "12345678")).toMatch(/^[a-f0-9]{64}$/u);
    expect(() =>
      repositoryDeliveryProposalSchema.parse({ ...p, forcePushAuthority: true }),
    ).toThrow();
    expect(() => repositoryDeliveryProposalSchema.parse({ ...p, mergeRequested: true })).toThrow();
  });

  it("executes checkpoint first and produces a fictional delivered result", async () => {
    const events: string[] = [];
    const result = await executeRepositoryDelivery(activation(), adapter(events));
    expect(result.verdict).toBe("delivered");
    expect(events).toEqual([
      "preflight",
      "verify",
      "commit",
      "checkpoint",
      "target",
      "draft-pr",
      "credential-cleared",
      "cleanup",
    ]);
    expect(result.mergePerformed).toBe(false);
    expect(result.deploymentPerformed).toBe(false);
  });

  it("fails closed after checkpoint without retry or hidden remote deletion", async () => {
    const events: string[] = [];
    const result = await executeRepositoryDelivery(activation(), adapter(events, "target"));
    expect(result.verdict).toBe("failed-after-partial-provider-write");
    expect(result.checkpointEqual).toBe(true);
    expect(result.targetEqual).toBe(false);
    expect(events.filter((event) => event === "target")).toHaveLength(1);
    expect(events).not.toContain("delete");
  });

  it("consumes exact approval before mutation and denies replay", async () => {
    const events: string[] = [];
    const approved = activation();
    await executeRepositoryDelivery(approved, adapter(events));
    await expect(executeRepositoryDelivery(approved, adapter(events))).rejects.toThrow(
      "DELIVERY_APPROVAL_DENIED",
    );
    expect(events.filter((event) => event === "preflight")).toHaveLength(1);
  });
});
