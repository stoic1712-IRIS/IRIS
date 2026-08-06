import { describe, expect, it } from "vitest";

import {
  GithubCliRepositoryProvider,
  type GithubCliProcessRunner,
} from "../packages/development/src/index.js";

const commit = "a".repeat(40);
const mergeCommit = "b".repeat(40);
const approvalDigest = `sha256:${"c".repeat(64)}`;

class RecordedRunner implements GithubCliProcessRunner {
  readonly calls: { executable: string; args: string[] }[] = [];
  readonly responses: string[];

  constructor(responses: string[]) {
    this.responses = responses;
  }

  run(executable: string, args: string[]): string {
    this.calls.push({ executable, args });
    const response = this.responses.shift();
    if (response === undefined) throw new Error("Unexpected provider call.");
    return response;
  }
}

function provider(runner: GithubCliProcessRunner): GithubCliRepositoryProvider {
  return new GithubCliRepositoryProvider({
    owner: "stoic1712-IRIS",
    repositories: {
      "stoic1712-IRIS/IRIS": { path: "C:/Projects/STOIC-IRIS", remote: "origin" },
    },
    ghPath: "C:/Program Files/GitHub CLI/gh.exe",
    runner,
  });
}

describe("Cycle Four governed GitHub CLI repository provider", () => {
  it("pushes an exact commit without force and verifies remote equality", async () => {
    const runner = new RecordedRunner([
      "stoic1712-IRIS",
      commit,
      "ok",
      `${commit}\trefs/heads/iris/cycle-four-proof`,
    ]);
    const result = await provider(runner).push({
      repository: "stoic1712-IRIS/IRIS",
      ref: "iris/cycle-four-proof",
      commit,
      force: false,
      authorization: {
        operation: "push-branch",
        repository: "stoic1712-IRIS/IRIS",
        target: "iris/cycle-four-proof",
        approvalDigest,
      },
    });

    expect(result.remoteCommit).toBe(commit);
    expect(runner.calls[2]?.args).toEqual([
      "-C",
      "C:/Projects/STOIC-IRIS",
      "push",
      "--porcelain",
      "origin",
      `${commit}:refs/heads/iris/cycle-four-proof`,
    ]);
    expect(runner.calls.flatMap(({ args }) => args)).not.toContain("--force");
  });

  it("creates only a verified draft pull request", async () => {
    const runner = new RecordedRunner([
      "stoic1712-IRIS",
      "https://github.com/stoic1712-IRIS/IRIS/pull/41",
      JSON.stringify({
        number: 41,
        url: "https://github.com/stoic1712-IRIS/IRIS/pull/41",
        isDraft: true,
        headRefOid: commit,
        state: "OPEN",
        mergeStateStatus: "CLEAN",
      }),
    ]);
    const result = await provider(runner).createPullRequest({
      repository: "stoic1712-IRIS/IRIS",
      base: "main",
      head: "iris/cycle-four-proof",
      title: "Cycle Four proof",
      body: "Verified provider proof.",
      draft: true,
      maintainersCanModify: false,
      headCommit: commit,
      authorization: {
        operation: "create-pull-request",
        repository: "stoic1712-IRIS/IRIS",
        target: "iris/cycle-four-proof",
        approvalDigest,
      },
    });

    expect(result).toMatchObject({ number: 41, draft: true, headCommit: commit });
    expect(runner.calls[1]?.args).toContain("--no-maintainer-edit");
  });

  it("merges only the approved pull request at the expected head commit", async () => {
    const runner = new RecordedRunner([
      "stoic1712-IRIS",
      JSON.stringify({
        number: 41,
        url: "https://github.com/stoic1712-IRIS/IRIS/pull/41",
        isDraft: false,
        headRefOid: commit,
        state: "OPEN",
        mergeStateStatus: "CLEAN",
      }),
      "merged",
      mergeCommit,
    ]);
    const result = await provider(runner).mergePullRequest({
      repository: "stoic1712-IRIS/IRIS",
      number: 41,
      expectedHeadCommit: commit,
      authorization: {
        operation: "merge-pull-request",
        repository: "stoic1712-IRIS/IRIS",
        target: "41",
        approvalDigest,
      },
    });

    expect(result.mergeCommit).toBe(mergeCommit);
    expect(runner.calls[2]?.args).toContain("--match-head-commit");
  });

  it("denies unlisted repositories and mismatched authority", () => {
    const instance = provider(new RecordedRunner([]));
    expect(() =>
      instance.push({
        repository: "other-owner/other-repository",
        ref: "iris/denied",
        commit,
        force: false,
        authorization: {
          operation: "push-branch",
          repository: "other-owner/other-repository",
          target: "iris/denied",
          approvalDigest,
        },
      }),
    ).toThrow(/NOT_ALLOWED/u);

    const runner = new RecordedRunner([]);
    expect(() =>
      provider(runner).push({
        repository: "stoic1712-IRIS/IRIS",
        ref: "iris/expected",
        commit,
        force: false,
        authorization: {
          operation: "merge-pull-request",
          repository: "stoic1712-IRIS/IRIS",
          target: "41",
          approvalDigest,
        },
      }),
    ).toThrow(/AUTHORIZATION_MISMATCH/u);
    expect(runner.calls).toHaveLength(0);
  });
});
