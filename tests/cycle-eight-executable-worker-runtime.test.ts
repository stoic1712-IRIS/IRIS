import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
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
  type ExecutableWorkerCleanupEvidence,
  type ExecutableWorkerJournal,
  type ExecutableWorkerPlan,
  type ExecutableWorkerPreflight,
  type ExecutableWorkerProposal,
  type ExecutableWorkerWorkspace,
} from "../packages/development/src/index.js";

const runFile = promisify(execFile);
const baseRevision = "a".repeat(40);
const now = "2026-08-06T12:00:00.000Z";

function sha256(value: string | Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

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
    baselineCommands: [["pnpm", "test"]],
    normalizationCommands: [["pnpm", "exec", "prettier", "--write", "--", "src/math.ts"]],
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
    outputBytes: 6,
    outputTruncated: false,
    outputRedacted: false,
  };
}

function cleanupEvidence(verified: boolean): ExecutableWorkerCleanupEvidence {
  return {
    workspaceRootVerified: true,
    gitRegistrationAbsent: verified,
    filesystemAbsent: verified,
    verified,
    attempts: [
      {
        step: "verify",
        attempt: 1,
        ok: verified,
        ...(verified ? {} : { code: "FIXTURE_CLEANUP_INCOMPLETE" }),
      },
    ],
    completedAt: now,
  };
}

class RecordingExecutionJournalStore extends MemoryExecutionJournalStore {
  readonly snapshots: ExecutableWorkerJournal[] = [];

  override async save(journal: ExecutableWorkerJournal): Promise<void> {
    this.snapshots.push(structuredClone(journal));
    await super.save(journal);
  }
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
  cleanupResults: boolean[] = [];
  nulOnCommand: string | undefined;

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
    if (command[0] === this.nulOnCommand) this.files.set("src/math.ts", "normalized\0content\n");
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
  cleanup(): Promise<ExecutableWorkerCleanupEvidence> {
    this.cleanupCount += 1;
    const verified = this.cleanupResults.shift() ?? true;
    if (verified) this.workspacePresent = false;
    return Promise.resolve(cleanupEvidence(verified));
  }
}

class SequencedAgent implements ExecutableWorkerAgent {
  readonly #plans: ExecutableWorkerPlan[];
  calls = 0;
  readonly inputs: Parameters<ExecutableWorkerAgent["plan"]>[0][] = [];

  constructor(plans: ExecutableWorkerPlan[]) {
    this.#plans = plans;
  }

  plan(input: Parameters<ExecutableWorkerAgent["plan"]>[0]): Promise<ExecutableWorkerPlan> {
    this.inputs.push(structuredClone(input));
    const current = this.#plans[Math.min(this.calls, this.#plans.length - 1)];
    this.calls += 1;
    if (current === undefined) throw new Error("FIXTURE_PLAN_MISSING");
    return Promise.resolve(current);
  }
}

function updatePlan(
  oldContent = "export const value = 1;\n",
  newContent = "export const value = 2;\n",
): ExecutableWorkerPlan {
  return {
    summary: "Update the exact bounded arithmetic implementation file.",
    mutations: [
      {
        path: "src/math.ts",
        operation: "update",
        expectedContentDigest: sha256(oldContent),
        replacements: [{ oldText: oldContent, newText: newContent }],
        rationale: "Correct the fixture behavior.",
      },
    ],
  };
}

describe("Cycle Eight executable worker contracts and runtime", () => {
  it("rejects repository-wide dot paths from exact read and write boundaries", () => {
    expect(() => proposal({ readPaths: ["."], writePaths: ["."] })).toThrow();
  });

  it("rejects complete-file update payloads so unrelated text cannot be rewritten", async () => {
    const adapter = new FixtureAdapter();
    const current = proposal();
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(
      current,
      approval(current),
      new SequencedAgent([
        {
          summary: "Attempt the obsolete complete-file replacement contract.",
          mutations: [
            {
              path: "src/math.ts",
              operation: "update",
              content: "corrupted unrelated text\n",
              rationale: "Exercise deterministic mutation validation.",
            } as never,
          ],
        },
      ]),
    );
    expect(result.status).toBe("recovery-ready");
    expect(adapter.files.get("src/math.ts")).toBe("export const value = 1;\n");
  });

  it("denies stale digests and non-unique exact replacements without changing the file", async () => {
    const adapter = new FixtureAdapter();
    adapter.files.set("src/math.ts", "const value = 1;\nconst other = 1;\n");
    const current = proposal({ materializationCommands: [], baselineCommands: [] });
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(
      current,
      approval(current),
      new SequencedAgent([
        {
          summary: "Attempt a replacement whose source text is ambiguous.",
          mutations: [
            {
              path: "src/math.ts",
              operation: "update",
              expectedContentDigest: sha256("const value = 1;\nconst other = 1;\n"),
              replacements: [{ oldText: "1", newText: "2" }],
              rationale: "Exercise unique-match enforcement.",
            },
          ],
        },
      ]),
    );
    expect(result.summary).toContain("EXECUTABLE_WORKER_REPLACEMENT_NOT_UNIQUE");
    expect(adapter.files.get("src/math.ts")).toBe("const value = 1;\nconst other = 1;\n");
  });

  it("denies a stale content digest before applying an otherwise unique replacement", async () => {
    const adapter = new FixtureAdapter();
    const current = proposal({ materializationCommands: [], baselineCommands: [] });
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(
      current,
      approval(current),
      new SequencedAgent([
        {
          summary: "Attempt a unique replacement against a stale source digest.",
          mutations: [
            {
              path: "src/math.ts",
              operation: "update",
              expectedContentDigest: sha256("stale content\n"),
              replacements: [
                { oldText: "export const value = 1;", newText: "export const value = 2;" },
              ],
              rationale: "Prove optimistic concurrency rejects stale source state.",
            },
          ],
        },
      ]),
    );
    expect(result.summary).toContain("EXECUTABLE_WORKER_CONTENT_DIGEST_MISMATCH");
    expect(adapter.files.get("src/math.ts")).toBe("export const value = 1;\n");
  });

  it("denies overlapping exact replacements without changing the file", async () => {
    const adapter = new FixtureAdapter();
    adapter.files.set("src/math.ts", "abcdef\n");
    const current = proposal({ materializationCommands: [], baselineCommands: [] });
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(
      current,
      approval(current),
      new SequencedAgent([
        {
          summary: "Attempt two overlapping exact replacements.",
          mutations: [
            {
              path: "src/math.ts",
              operation: "update",
              expectedContentDigest: sha256("abcdef\n"),
              replacements: [
                { oldText: "abc", newText: "ABC" },
                { oldText: "bcd", newText: "BCD" },
              ],
              rationale: "Exercise overlap enforcement.",
            },
          ],
        },
      ]),
    );
    expect(result.summary).toContain("EXECUTABLE_WORKER_REPLACEMENT_OVERLAP");
    expect(adapter.files.get("src/math.ts")).toBe("abcdef\n");
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
      "verifying",
      "planning",
      "editing",
      "verifying",
      "verifying",
      "checkpointing",
      "completed",
    ]);
    expect(adapter.cleanupCount).toBe(1);
  });

  it("feeds failed checks into a bounded repair iteration", async () => {
    const adapter = new FixtureAdapter();
    adapter.commandResults = [0, 0, 0, 1, 0, 0];
    const agent = new SequencedAgent([
      updatePlan("export const value = 1;\n", "export const value = 2;\n"),
      updatePlan("export const value = 2;\n", "export const value = 3;\n"),
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

  it("fails closed when a restart journal changes the approved proposal", async () => {
    const adapter = new FixtureAdapter();
    const journals = new MemoryExecutionJournalStore();
    const runtime = new ExecutableWorkerRuntime({ adapter, journals, now: () => new Date(now) });
    const current = proposal();
    const controller = new AbortController();
    controller.abort();
    await runtime.execute(
      current,
      approval(current),
      new SequencedAgent([updatePlan()]),
      controller.signal,
    );
    const stored = await journals.load(current.executionId);
    if (stored === null) throw new Error("Expected the interrupted journal to be durable.");
    await journals.save({
      ...stored,
      proposal: {
        ...stored.proposal,
        maximumChangedFiles: stored.proposal.maximumChangedFiles + 1,
      },
    });
    await expect(
      runtime.resume(current.executionId, new SequencedAgent([updatePlan()])),
    ).rejects.toThrow("EXECUTABLE_WORKER_JOURNAL_APPROVAL_BINDING_INVALID");
  });

  it("rejects NUL bytes introduced by a normalization command before checkpointing", async () => {
    const adapter = new FixtureAdapter();
    adapter.nulOnCommand = "normalize";
    const current = proposal({
      materializationCommands: [],
      baselineCommands: [],
      normalizationCommands: [["normalize"]],
      commands: [["verify"]],
    });
    const result = await new ExecutableWorkerRuntime({
      adapter,
      journals: new MemoryExecutionJournalStore(),
      now: () => new Date(now),
    }).execute(current, approval(current), new SequencedAgent([updatePlan()]));
    expect(result).toMatchObject({ status: "recovery-ready" });
    expect(result.summary).toContain("EXECUTABLE_WORKER_NUL_CONTENT_DENIED:src/math.ts");
  });

  it("persists every command result and supplies the last failed checks after restart", async () => {
    const adapter = new FixtureAdapter();
    adapter.commandResults = [0, 0, 0, 1];
    const journals = new MemoryExecutionJournalStore();
    const current = proposal({ maximumIterations: 3 });
    const runtime = new ExecutableWorkerRuntime({
      adapter,
      journals,
      now: () => new Date(now),
    });
    let planningCalls = 0;
    const failed = await runtime.execute(current, approval(current), {
      plan() {
        planningCalls += 1;
        if (planningCalls > 1) throw new Error("SIMULATED_PROCESS_RESTART");
        return Promise.resolve(updatePlan());
      },
    });
    expect(failed.status).toBe("recovery-ready");
    const stored = await runtime.journal(current.executionId);
    expect(stored?.materializationChecks).toHaveLength(1);
    expect(stored?.baselineChecks).toHaveLength(1);
    expect(stored?.attempts[0]?.normalizationChecks).toHaveLength(1);
    expect(stored?.attempts[0]?.verificationChecks).toHaveLength(1);
    const resumedAgent = new SequencedAgent([
      updatePlan("export const value = 2;\n", "export const value = 3;\n"),
    ]);
    const resumed = await runtime.resume(current.executionId, resumedAgent);
    expect(resumed.status).toBe("succeeded");
    expect(resumedAgent.inputs[0]?.previousChecks).toEqual([
      expect.objectContaining({
        command: ["pnpm", "exec", "prettier", "--write", "--", "src/math.ts"],
      }),
      expect.objectContaining({ command: ["pnpm", "test"], exitCode: 1 }),
    ]);
  });

  it("fails closed when asked to resume a legacy journal without version-two evidence", async () => {
    const adapter = new FixtureAdapter();
    const journals = new MemoryExecutionJournalStore();
    const runtime = new ExecutableWorkerRuntime({ adapter, journals, now: () => new Date(now) });
    const current = proposal();
    const controller = new AbortController();
    controller.abort();
    await runtime.execute(
      current,
      approval(current),
      new SequencedAgent([updatePlan()]),
      controller.signal,
    );
    const stored = await journals.load(current.executionId);
    if (stored === null) throw new Error("Expected the interrupted journal to be durable.");
    await journals.save({ ...stored, journalVersion: 1 });
    await expect(
      runtime.resume(current.executionId, new SequencedAgent([updatePlan()])),
    ).rejects.toThrow("EXECUTABLE_WORKER_JOURNAL_EVIDENCE_INCOMPLETE");
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

  it("keeps cleanup failure recovery-ready and permits an idempotent retry", async () => {
    const adapter = new FixtureAdapter();
    adapter.cleanupResults = [false, true];
    const current = proposal({ materializationCommands: [], baselineCommands: [] });
    const journals = new RecordingExecutionJournalStore();
    const runtime = new ExecutableWorkerRuntime({
      adapter,
      journals,
      now: () => new Date(now),
    });
    const failed = await runtime.execute(
      current,
      approval(current),
      new SequencedAgent([updatePlan()]),
    );
    expect(failed).toMatchObject({ status: "recovery-ready", cleanupVerified: false });
    expect(
      journals.snapshots.some(
        (journal) => journal.candidateCommit !== undefined && journal.cleanup === undefined,
      ),
    ).toBe(true);
    expect(adapter.workspacePresent).toBe(true);
    await expect(runtime.discard(current.executionId)).resolves.toBe(true);
    expect((await runtime.journal(current.executionId))?.state).toBe("stopped");
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
  it("preserves the original file and removes its temporary artifact when atomic rename fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-atomic-write-test-"));
    try {
      await writeFile(join(directory, "bounded.txt"), "original\n", "utf8");
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      const adapter = new GitCandidateWorkspaceAdapter({
        canonicalPath: directory,
        renameFile: () => Promise.reject(new Error("ATOMIC_RENAME_FAILURE")),
      });
      await expect(
        adapter.writeFile(
          { id: "workspace_atomic", path: directory, baseRevision, disposable: true },
          "bounded.txt",
          "replacement\n",
        ),
      ).rejects.toThrow("ATOMIC_RENAME_FAILURE");
      expect(await readFile(join(directory, "bounded.txt"), "utf8")).toBe("original\n");
      expect((await readdir(directory)).filter((path) => path.includes(".tmp"))).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("stores only redacted bounded command output while preserving the raw digest and byte count", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-output-test-"));
    try {
      const raw = `github_pat_${"a".repeat(30)}\n${"x".repeat(70_000)}`;
      const result = await new GitCandidateWorkspaceAdapter({ canonicalPath: directory }).run(
        { id: "workspace_output", path: directory, baseRevision, disposable: true },
        [
          "node",
          "-e",
          "process.stdout.write('github_pat_' + 'a'.repeat(30) + '\\n' + 'x'.repeat(70000))",
        ],
        new AbortController().signal,
      );
      expect(result.output).not.toContain("github_pat_");
      expect(result.output).toContain("[REDACTED]");
      expect(result.outputDigest).toBe(sha256(raw));
      expect(result.outputBytes).toBe(Buffer.byteLength(raw));
      expect(result.outputRedacted).toBe(true);
      expect(result.outputTruncated).toBe(true);
      expect(Buffer.byteLength(result.output)).toBeLessThanOrEqual(64_000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("hashes observed stdout and stderr bytes without synthetic process error text", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-output-bytes-test-"));
    try {
      const stdout = Buffer.from([0xff, 0x00, 0x61]);
      const stderr = Buffer.from([0xfe, 0x62]);
      const result = await new GitCandidateWorkspaceAdapter({ canonicalPath: directory }).run(
        { id: "workspace_output_bytes", path: directory, baseRevision, disposable: true },
        [
          "node",
          "-e",
          "process.stdout.write(Buffer.from([255,0,97]));process.stderr.write(Buffer.from([254,98]));process.exit(2)",
        ],
        new AbortController().signal,
      );
      expect(result.exitCode).toBe(2);
      expect(result.outputDigest).toBe(sha256(Buffer.concat([stdout, stderr])));
      expect(result.outputBytes).toBe(stdout.length + stderr.length);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses cleanup outside the exact executable-worker workspace root", async () => {
    const directory = await mkdtemp(join(tmpdir(), "unrelated-cleanup-target-"));
    const safeRoot = await mkdtemp(join(tmpdir(), "iris-cycle8-cleanup-root-"));
    try {
      const evidence = await new GitCandidateWorkspaceAdapter({
        canonicalPath: directory,
        workspaceRoot: safeRoot,
      }).cleanup({ id: "workspace_escape", path: directory, baseRevision, disposable: true });
      expect(evidence).toMatchObject({ workspaceRootVerified: false, verified: false });
      await expect(access(directory)).resolves.toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(safeRoot, { recursive: true, force: true });
    }
  });

  it("removes a registered worktree whose directory is already missing and remains idempotent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "iris-cycle8-cleanup-repo-"));
    const safeRoot = await mkdtemp(join(tmpdir(), "iris-cycle8-cleanup-root-"));
    try {
      await writeFile(join(directory, "README.md"), "cleanup fixture\n", "utf8");
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      await runFile("git", ["config", "core.autocrlf", "false"], { cwd: directory });
      await runFile("git", ["add", "README.md"], { cwd: directory });
      await runFile(
        "git",
        [
          "-c",
          "user.name=IRIS Test",
          "-c",
          "user.email=iris-test@local.invalid",
          "commit",
          "-m",
          "cleanup fixture",
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
        executionId: "execution_cycle8-cleanup-test-0001",
        baseRevision: head,
        branch: "iris/candidate/cycle8-cleanup-test-0001",
        readPaths: ["README.md"],
        writePaths: ["README.md"],
        materializationCommands: [],
        baselineCommands: [],
        normalizationCommands: [],
        commands: [["node", "--version"]],
      });
      const adapter = new GitCandidateWorkspaceAdapter({
        canonicalPath: directory,
        workspaceRoot: safeRoot,
      });
      const workspace = await adapter.createWorkspace(current);
      await rm(workspace.path, { recursive: true, force: true });

      await expect(adapter.cleanup(workspace)).resolves.toMatchObject({
        workspaceRootVerified: true,
        gitRegistrationAbsent: true,
        filesystemAbsent: true,
        verified: true,
      });
      await expect(adapter.cleanup(workspace)).resolves.toMatchObject({
        workspaceRootVerified: true,
        gitRegistrationAbsent: true,
        filesystemAbsent: true,
        verified: true,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(safeRoot, { recursive: true, force: true });
    }
  });

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
      await runFile("git", ["config", "core.autocrlf", "false"], { cwd: directory });
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
        baselineCommands: [["node", "--check", "math.js"]],
        normalizationCommands: [],
        commands: [["node", "--check", "math.js"]],
      });
      const agent = new SequencedAgent([
        {
          summary: "Update the exact disposable JavaScript fixture implementation.",
          mutations: [
            {
              path: "math.js",
              operation: "update",
              expectedContentDigest: sha256("export const value = 1;\n"),
              replacements: [
                {
                  oldText: "export const value = 1;\n",
                  newText: "export const value = 2;\n",
                },
              ],
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
      await runFile("git", ["init", "-b", "main"], { cwd: directory });
      await runFile("git", ["config", "core.symlinks", "false"], { cwd: directory });
      const linkPayload = join(directory, ".symlink-target");
      await writeFile(linkPayload, externalFile, "utf8");
      const blob = (
        await runFile("git", ["hash-object", "-w", linkPayload], { cwd: directory })
      ).stdout.trim();
      await unlink(linkPayload);
      await runFile("git", ["update-index", "--add", "--cacheinfo", `120000,${blob},linked.txt`], {
        cwd: directory,
      });
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
      await runFile("git", ["checkout-index", "--force", "--", "linked.txt"], { cwd: directory });
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
        baselineCommands: [],
        normalizationCommands: [],
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
                expectedContentDigest: sha256("outside remains unchanged\n"),
                replacements: [
                  { oldText: "outside remains unchanged\n", newText: "unsafe write\n" },
                ],
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
