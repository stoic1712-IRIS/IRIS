import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  ExecutableWorkerRuntime,
  GitCandidateWorkspaceAdapter,
  MemoryExecutionJournalStore,
  executableWorkerProposalDigest,
  executableWorkerProposalSchema,
  requiredExecutableWorkerApproval,
  type ExecutableWorkerAdapter,
  type ExecutableWorkerAgent,
  type ExecutableWorkerApproval,
  type ExecutableWorkerCheck,
  type ExecutableWorkerPlan,
  type ExecutableWorkerPreflight,
  type ExecutableWorkerProposal,
  type ExecutableWorkerWorkspace,
} from "../packages/development/src/index.js";

const runFile = promisify(execFile);
const baseRevision = "a".repeat(40);
const now = "2026-08-06T12:00:00.000Z";

function proposal(overrides: Partial<ExecutableWorkerProposal> = {}): ExecutableWorkerProposal {
  return executableWorkerProposalSchema.parse({
    executionId: "execution_cycle8-runtime-test-0001",
    objective: "Repair the bounded arithmetic fixture and prove the candidate locally.",
    repository: "stoic1712-IRIS/IRIS",
    baseRevision,
    branch: "iris/candidate/cycle8-runtime-test-0001",
    readPaths: ["src", "tests"],
    writePaths: ["src"],
    forbiddenPaths: [".git", ".github", "docs/governance"],
    materializationCommands: [["pnpm", "install", "--offline", "--frozen-lockfile"]],
    commands: [["pnpm", "test"]],
    maximumIterations: 3,
    maximumChangedFiles: 5,
    maximumChangedBytes: 100_000,
    timeoutMs: 60_000,
    expiresAt: "2026-08-07T12:00:00.000Z",
    budgetUsd: 0,
    canonicalWrite: false,
    externalMutation: false,
    mayExpand: false,
    createdAt: now,
    ...overrides,
  });
}

function approval(current = proposal()): ExecutableWorkerApproval {
  return {
    approvalId: "approval_cycle8-runtime-test-0001",
    executionId: current.executionId,
    proposalDigest: executableWorkerProposalDigest(current),
    approvedBy: "Founder",
    typedStatement: requiredExecutableWorkerApproval(current),
    issuedAt: now,
  };
}

function check(command: string[], exitCode = 0): ExecutableWorkerCheck {
  return {
    command,
    exitCode,
    output: exitCode === 0 ? "passed" : "failed",
    outputDigest: `sha256:${(exitCode === 0 ? "b" : "c").repeat(64)}`,
  };
}

class FixtureAdapter implements ExecutableWorkerAdapter {
  readonly files = new Map<string, string>([["src/math.ts", "export const value = 1;\n"]]);
  readonly workspace: ExecutableWorkerWorkspace = {
    id: "workspace_fixture",
    path: "/tmp/fixture",
    baseRevision,
    disposable: true,
  };
  ready = true;
  workspacePresent = false;
  createCount = 0;
  cleanupCount = 0;
  commandResults: number[] = [];

  preflight(): Promise<ExecutableWorkerPreflight> {
    return Promise.resolve({
      ready: this.ready,
      checks: [
        {
          capability: "fixture",
          status: this.ready ? "ready" : "blocked",
          detail: this.ready ? "Fixture is ready." : "Fixture is blocked.",
        },
      ],
    });
  }
  createWorkspace(): Promise<ExecutableWorkerWorkspace> {
    this.createCount += 1;
    this.workspacePresent = true;
    return Promise.resolve(this.workspace);
  }
  workspaceExists(): Promise<boolean> {
    return Promise.resolve(this.workspacePresent);
  }
  context(): Promise<string> {
    return Promise.resolve(this.files.get("src/math.ts") ?? "");
  }
  diff(): Promise<string> {
    return Promise.resolve("diff --git a/src/math.ts b/src/math.ts");
  }
  readFile(_workspace: ExecutableWorkerWorkspace, path: string): Promise<string | null> {
    return Promise.resolve(this.files.get(path) ?? null);
  }
  writeFile(_workspace: ExecutableWorkerWorkspace, path: string, content: string): Promise<void> {
    this.files.set(path, content);
    return Promise.resolve();
  }
  deleteFile(_workspace: ExecutableWorkerWorkspace, path: string): Promise<void> {
    this.files.delete(path);
    return Promise.resolve();
  }
  run(_workspace: ExecutableWorkerWorkspace, command: string[]): Promise<ExecutableWorkerCheck> {
    return Promise.resolve(check(command, this.commandResults.shift() ?? 0));
  }
  changedPaths(): Promise<string[]> {
    return Promise.resolve(["src/math.ts"]);
  }
  checkpoint(): Promise<{ commit: string; ref: string; diff: string }> {
    return Promise.resolve({
      commit: "d".repeat(40),
      ref: "refs/heads/iris/candidate/cycle8-runtime-test-0001",
      diff: "diff --git a/src/math.ts b/src/math.ts",
    });
  }
  cleanup(): Promise<boolean> {
    this.cleanupCount += 1;
    this.workspacePresent = false;
    return Promise.resolve(true);
  }
}

class SequencedAgent implements ExecutableWorkerAgent {
  readonly #plans: ExecutableWorkerPlan[];
  calls = 0;

  constructor(plans: ExecutableWorkerPlan[]) {
    this.#plans = plans;
  }

  plan(): Promise<ExecutableWorkerPlan> {
    const current = this.#plans[Math.min(this.calls, this.#plans.length - 1)];
    this.calls += 1;
    if (current === undefined) throw new Error("FIXTURE_PLAN_MISSING");
    return Promise.resolve(current);
  }
}

function updatePlan(content = "export const value = 2;\n"): ExecutableWorkerPlan {
  return {
    summary: "Update the exact bounded arithmetic implementation file.",
    mutations: [
      {
        path: "src/math.ts",
        operation: "update",
        content,
        rationale: "Correct the fixture behavior.",
      },
    ],
  };
}

describe("Cycle Eight executable worker contracts and runtime", () => {
  it("rejects repository-wide dot paths from exact read and write boundaries", () => {
    expect(() => proposal({ readPaths: ["."], writePaths: ["."] })).toThrow();
  });

  it("denies an approval that is not bound to the exact proposal before creating a workspace", async () => {
    const adapter = new FixtureAdapter();
    const current = proposal();
    const invalid = { ...approval(current), typedStatement: "I approve something else." };
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(current, invalid, new SequencedAgent([updatePlan()]));
    expect(result).toMatchObject({ status: "denied", cleanupVerified: true });
    expect(adapter.createCount).toBe(0);
  });

  it("fails closed when capability preflight is blocked", async () => {
    const adapter = new FixtureAdapter();
    adapter.ready = false;
    const current = proposal();
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(current, approval(current), new SequencedAgent([updatePlan()]));
    expect(result.status).toBe("denied");
    expect(result.summary).toContain("preflight blocked");
    expect(adapter.createCount).toBe(0);
  });

  it("materializes, edits, verifies, checkpoints, validates its event chain, and cleans up", async () => {
    const adapter = new FixtureAdapter();
    const current = proposal();
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(current, approval(current), new SequencedAgent([updatePlan()]));
    expect(result).toMatchObject({
      status: "succeeded",
      candidateCommit: "d".repeat(40),
      cleanupVerified: true,
      eventChainVerified: true,
    });
    expect(result.events.map((event) => event.state)).toEqual([
      "preparing-workspace",
      "materializing",
      "planning",
      "editing",
      "verifying",
      "checkpointing",
      "completed",
    ]);
    expect(adapter.cleanupCount).toBe(1);
  });

  it("feeds failed checks into a bounded repair iteration", async () => {
    const adapter = new FixtureAdapter();
    adapter.commandResults = [0, 1, 0];
    const agent = new SequencedAgent([
      updatePlan("export const value = 2;\n"),
      updatePlan("export const value = 3;\n"),
    ]);
    const current = proposal();
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(current, approval(current), agent);
    expect(result).toMatchObject({ status: "succeeded", iteration: 2 });
    expect(agent.calls).toBe(2);
    expect(adapter.files.get("src/math.ts")).toContain("3");
  });

  it("preserves an interrupted workspace and resumes under the unchanged approval", async () => {
    const adapter = new FixtureAdapter();
    const journals = new MemoryExecutionJournalStore();
    const runtime = new ExecutableWorkerRuntime({
      adapter,
      journals,
      now: () => new Date(now),
    });
    const current = proposal();
    const controller = new AbortController();
    controller.abort();
    const stopped = await runtime.execute(
      current,
      approval(current),
      new SequencedAgent([updatePlan()]),
      controller.signal,
    );
    expect(stopped).toMatchObject({ status: "stopped", recoveryAvailable: true });
    expect(adapter.workspacePresent).toBe(true);
    const resumed = await runtime.resume(current.executionId, new SequencedAgent([updatePlan()]));
    expect(resumed).toMatchObject({
      status: "succeeded",
      cleanupVerified: true,
      eventChainVerified: true,
    });
  });

  it("fails closed and preserves recovery evidence when offline materialization fails", async () => {
    const adapter = new FixtureAdapter();
    adapter.commandResults = [1];
    const current = proposal();
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(current, approval(current), new SequencedAgent([updatePlan()]));
    expect(result).toMatchObject({
      status: "recovery-ready",
      summary: "EXECUTABLE_WORKER_MATERIALIZATION_FAILED",
      recoveryAvailable: true,
    });
    expect(result.checks).toHaveLength(1);
  });

  it("preserves a failed workspace for recovery and permits an explicit discard", async () => {
    const adapter = new FixtureAdapter();
    const current = proposal();
    const forbiddenPlan: ExecutableWorkerPlan = {
      summary: "Attempt an edit outside the exact approved write boundary.",
      mutations: [
        {
          path: "README.md",
          operation: "create",
          content: "not allowed\n",
          rationale: "Exercise fail-closed path validation.",
        },
      ],
    };
    const runtime = new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    });
    const result = await runtime.execute(
      current,
      approval(current),
      new SequencedAgent([forbiddenPlan]),
    );
    expect(result).toMatchObject({ status: "recovery-ready", recoveryAvailable: true });
    expect(adapter.workspacePresent).toBe(true);
    await expect(runtime.discard(current.executionId)).resolves.toBe(true);
    expect(adapter.workspacePresent).toBe(false);
  });
});

describe("Cycle Eight real disposable Git workspace", () => {
  it("keeps UTF-8 repository context within the exact byte budget", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-context-test-"));
    try {
      await writeFile(join(directory, "café.txt"), "é".repeat(100), "utf8");
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      await runFile("git", ["add", "café.txt"], { cwd: directory });
      const adapter = new GitCandidateWorkspaceAdapter({
        canonicalPath: directory,
        maximumContextBytes: 40,
      });
      const context = await adapter.context(
        { id: "workspace_context", path: directory, baseRevision, disposable: true },
        proposal({ readPaths: ["café.txt"], writePaths: ["café.txt"] }),
      );
      expect(Buffer.byteLength(context)).toBeLessThanOrEqual(40);
      expect(context).not.toContain("�");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("parses renamed and UTF-8 paths from zero-delimited Git status", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-status-test-"));
    try {
      await writeFile(join(directory, "café.ts"), "export const value = 1;\n", "utf8");
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      await runFile("git", ["add", "café.ts"], { cwd: directory });
      await runFile(
        "git",
        [
          "-c",
          "user.name=IRIS Test",
          "-c",
          "user.email=iris-test@local.invalid",
          "commit",
          "-m",
          "fixture",
        ],
        { cwd: directory },
      );
      await mkdir(join(directory, "src"));
      await runFile("git", ["mv", "café.ts", "src/renamed.ts"], { cwd: directory });
      const changedPaths = await new GitCandidateWorkspaceAdapter({
        canonicalPath: directory,
      }).changedPaths({
        id: "workspace_status",
        path: directory,
        baseRevision,
        disposable: true,
      });
      expect(changedPaths).toEqual(["café.ts", "src/renamed.ts"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("creates a local candidate commit while leaving the canonical branch and files untouched", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-test-"));
    try {
      await writeFile(join(directory, "math.js"), "export const value = 1;\n", "utf8");
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      await runFile("git", ["add", "math.js"], { cwd: directory });
      await runFile(
        "git",
        [
          "-c",
          "user.name=IRIS Test",
          "-c",
          "user.email=iris-test@local.invalid",
          "commit",
          "-m",
          "fixture",
        ],
        { cwd: directory },
      );
      await runFile(
        "git",
        ["remote", "add", "origin", "https://github.com/stoic1712-IRIS/IRIS.git"],
        { cwd: directory },
      );
      const head = (await runFile("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
      const current = proposal({
        executionId: "execution_cycle8-real-git-test-0001",
        baseRevision: head,
        branch: "iris/candidate/cycle8-real-git-test-0001",
        readPaths: ["math.js"],
        writePaths: ["math.js"],
        materializationCommands: [],
        commands: [["node", "--check", "math.js"]],
      });
      const agent = new SequencedAgent([
        {
          summary: "Update the exact disposable JavaScript fixture implementation.",
          mutations: [
            {
              path: "math.js",
              operation: "update",
              content: "export const value = 2;\n",
              rationale: "Prove a bounded disposable candidate edit.",
            },
          ],
        },
      ]);
      const result = await new ExecutableWorkerRuntime({
        adapter: new GitCandidateWorkspaceAdapter({ canonicalPath: directory }),
        journals: new MemoryExecutionJournalStore(),
        now: () => new Date(now),
      }).execute(current, approval(current), agent);
      expect(result).toMatchObject({
        status: "succeeded",
        cleanupVerified: true,
        changedPaths: ["math.js"],
      });
      expect(await readFile(join(directory, "math.js"), "utf8")).toBe("export const value = 1;\n");
      expect((await runFile("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim()).toBe(
        head,
      );
      expect(
        (await runFile("git", ["branch", "--show-current"], { cwd: directory })).stdout.trim(),
      ).toBe("main");
      expect(
        (await runFile("git", ["show", `${current.branch}:math.js`], { cwd: directory })).stdout,
      ).toBe("export const value = 2;\n");
      expect((await runFile("git", ["status", "--porcelain"], { cwd: directory })).stdout).toBe("");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("denies a tracked symlink without modifying its external target", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-symlink-repo-"));
    const external = await mkdtemp(join(tmpdir(), "iris-cycle8-symlink-target-"));
    const externalFile = join(external, "outside.txt");
    try {
      await writeFile(externalFile, "outside remains unchanged\n", "utf8");
      await symlink(externalFile, join(directory, "linked.txt"));
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      await runFile("git", ["add", "linked.txt"], { cwd: directory });
      await runFile(
        "git",
        [
          "-c",
          "user.name=IRIS Test",
          "-c",
          "user.email=iris-test@local.invalid",
          "commit",
          "-m",
          "symlink fixture",
        ],
        { cwd: directory },
      );
      await runFile(
        "git",
        ["remote", "add", "origin", "https://github.com/stoic1712-IRIS/IRIS.git"],
        { cwd: directory },
      );
      const head = (await runFile("git", ["rev-parse", "HEAD"], { cwd: directory })).stdout.trim();
      const current = proposal({
        executionId: "execution_cycle8-symlink-test-0001",
        baseRevision: head,
        branch: "iris/candidate/cycle8-symlink-test-0001",
        readPaths: ["linked.txt"],
        writePaths: ["linked.txt"],
        materializationCommands: [],
        commands: [["node", "--version"]],
      });
      const runtime = new ExecutableWorkerRuntime({
        adapter: new GitCandidateWorkspaceAdapter({ canonicalPath: directory }),
        journals: new MemoryExecutionJournalStore(),
        now: () => new Date(now),
      });
      const result = await runtime.execute(
        current,
        approval(current),
        new SequencedAgent([
          {
            summary: "Attempt to replace the exact tracked symbolic-link fixture.",
            mutations: [
              {
                path: "linked.txt",
                operation: "update",
                content: "unsafe write\n",
                rationale: "Exercise the symbolic-link boundary.",
              },
            ],
          },
        ]),
      );
      expect(result).toMatchObject({ status: "recovery-ready" });
      expect(result.summary).toContain("EXECUTABLE_WORKER_SYMLINK_DENIED");
      expect(await readFile(externalFile, "utf8")).toBe("outside remains unchanged\n");
      await expect(runtime.discard(current.executionId)).resolves.toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });
});
