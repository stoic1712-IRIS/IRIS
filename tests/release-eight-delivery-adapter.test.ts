import { describe, expect, it } from "vitest";
import {
  GovernedRepositoryDeliveryAdapter,
  createRepositoryDeliveryProposal,
  type DeliveryProviderController,
} from "../packages/kernel/src/index.js";

const revision = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const proposal = createRepositoryDeliveryProposal({
  repository: "stoic1712-IRIS/IRIS",
  baseRevision: revision,
  expectedLocalMainRevision: revision,
  expectedRemoteMainRevision: revision,
  repairResult: {
    verdict: "verified",
    summary: "verified candidate",
    repository: "stoic1712-IRIS/IRIS",
    baseRevision: revision,
    candidateId: "candidate_release-seven-aaaaaaaaaaaa",
    diffDigest: digest,
    changedFiles: [{ path: "README.md", beforeDigest: digest, afterDigest: digest }],
    diff: "diff",
    verification: [
      {
        command: "strict-typecheck",
        state: "passed",
        exitCode: 0,
        durationMs: 1,
        output: "passed",
      },
    ],
    canonicalRepositoryChanged: false,
    githubChanged: false,
    cleanupState: "completed",
    expiresAt: "2026-08-06T00:00:00.000Z",
  },
});

describe("Release Eight fixed delivery adapter", () => {
  it("enforces checkpoint, target, and draft PR ordering with exact fields", async () => {
    const calls: unknown[] = [];
    const provider: DeliveryProviderController = {
      push: (input) => {
        calls.push(input);
        return Promise.resolve({ remoteCommit: "c".repeat(40) });
      },
      createPullRequest: (input) => {
        calls.push(input);
        return Promise.resolve({
          number: 8,
          url: "https://github.com/example/repo/pull/8",
          draft: true,
          headCommit: "c".repeat(40),
        });
      },
      clearCredential: () => calls.push("cleared"),
    };
    const adapter = new GovernedRepositoryDeliveryAdapter({
      workspace: {
        preflight: () => Promise.resolve(),
        reconstructAndVerify: () => Promise.resolve(digest),
        createCommit: () => Promise.resolve("c".repeat(40)),
        cleanup: () => Promise.resolve(),
      },
      provider,
    });
    await expect(adapter.pushTarget(proposal, "c".repeat(40))).rejects.toThrow(
      "CHECKPOINT_FIRST_REQUIRED",
    );
    await adapter.pushCheckpoint(proposal, "c".repeat(40));
    await adapter.pushTarget(proposal, "c".repeat(40));
    await adapter.createDraftPullRequest(proposal, "c".repeat(40));
    expect(calls).toMatchObject([
      { repository: "stoic1712-IRIS/IRIS-checkpoints", force: false },
      { repository: "stoic1712-IRIS/IRIS", force: false },
      { base: "main", draft: true, maintainersCanModify: false },
    ]);
  });
});
