import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, unlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { digestText, type DevelopmentProposal } from "./contracts.js";
import type {
  CommandResult,
  DevelopmentAdapter,
  DevelopmentWorkspace,
  PaidResourceProvider,
} from "./sovereign-development-runtime.js";

const executeFile = promisify(execFile);

export class GitDevelopmentAdapter implements DevelopmentAdapter {
  readonly #canonicalPath: string;
  readonly #paidResourceProvider: PaidResourceProvider;

  constructor(options: { canonicalPath: string; paidResourceProvider: PaidResourceProvider }) {
    this.#canonicalPath = resolve(options.canonicalPath);
    this.#paidResourceProvider = options.paidResourceProvider;
  }

  async createWorkspace(proposal: DevelopmentProposal): Promise<DevelopmentWorkspace> {
    const path = await mkdtemp(join(tmpdir(), "iris-sovereign-development-"));
    await rm(path, { recursive: true, force: true });
    await this.#git(
      ["worktree", "add", "--detach", path, proposal.baseRevision],
      this.#canonicalPath,
    );
    return {
      id: `workspace_${proposal.proposalId}`,
      path,
      baseRevision: proposal.baseRevision,
      disposable: true,
    };
  }

  async readFile(workspace: DevelopmentWorkspace, path: string): Promise<string | null> {
    try {
      return await readFile(this.#resolve(workspace, path), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async writeFile(workspace: DevelopmentWorkspace, path: string, content: string): Promise<void> {
    const target = this.#resolve(workspace, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  async deleteFile(workspace: DevelopmentWorkspace, path: string): Promise<void> {
    await unlink(this.#resolve(workspace, path));
  }
  async run(workspace: DevelopmentWorkspace, command: string[]): Promise<CommandResult> {
    const executable = command[0];
    if (executable === undefined) throw new Error("Empty governed command.");
    try {
      const { stdout, stderr } = await executeFile(executable, command.slice(1), {
        cwd: workspace.path,
        timeout: 300_000,
        maxBuffer: 10_000_000,
      });
      return { command, exitCode: 0, outputDigest: digestText(`${stdout}${stderr}`) };
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      return {
        command,
        exitCode: typeof failure.code === "number" ? failure.code : 1,
        outputDigest: digestText(`${failure.stdout ?? ""}${failure.stderr ?? ""}`),
      };
    }
  }
  async verify(workspace: DevelopmentWorkspace, proposal: DevelopmentProposal): Promise<string[]> {
    const findings: string[] = [];
    const { stdout } = await this.#git(["status", "--porcelain", "-uall"], workspace.path);
    const actual = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3).replaceAll("\\", "/"))
      .sort();
    const expected = proposal.changes.map((change) => change.path).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      findings.push(`Changed paths differ: ${actual.join(", ")}`);
    const check = await this.run(workspace, ["git", "diff", "--check"]);
    if (check.exitCode !== 0) findings.push("git diff --check failed.");
    return findings;
  }
  async checkpoint(
    workspace: DevelopmentWorkspace,
    proposal: DevelopmentProposal,
  ): Promise<{ commit: string; remoteRevision: string }> {
    await this.#git(["switch", "-c", proposal.branch], workspace.path);
    await this.#git(
      ["add", "--", ...proposal.changes.map((change) => change.path)],
      workspace.path,
    );
    await this.#git(["commit", "-m", `feat: ${proposal.objective}`], workspace.path);
    const { stdout: commit } = await this.#git(["rev-parse", "HEAD"], workspace.path);
    await this.#git(
      ["push", proposal.checkpointRemote, `HEAD:refs/heads/${proposal.branch}`],
      workspace.path,
    );
    const { stdout: remote } = await this.#git(
      ["ls-remote", proposal.checkpointRemote, `refs/heads/${proposal.branch}`],
      workspace.path,
    );
    return { commit: commit.trim(), remoteRevision: remote.trim().split(/\s+/)[0] ?? "" };
  }
  rollbackEvidence(_workspace: DevelopmentWorkspace, checkpoint: string) {
    return Promise.resolve({
      command: `git revert ${checkpoint}`,
      preservesHistory: true as const,
    });
  }
  async cleanup(workspace: DevelopmentWorkspace): Promise<boolean> {
    await this.#git(["worktree", "remove", "--force", workspace.path], this.#canonicalPath);
    await this.#git(["worktree", "prune"], this.#canonicalPath);
    await rm(workspace.path, { recursive: true, force: true });
    return true;
  }
  terminatePaidResources() {
    return this.#paidResourceProvider.terminate();
  }
  provisionPaidResources() {
    return this.#paidResourceProvider.provision();
  }
  providerResources() {
    return this.#paidResourceProvider.list();
  }

  #resolve(workspace: DevelopmentWorkspace, path: string): string {
    const target = resolve(workspace.path, path);
    if (target !== workspace.path && !target.startsWith(`${workspace.path}${sep}`))
      throw new Error("Path escaped the disposable workspace.");
    return target;
  }
  #git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return executeFile("git", args, { cwd, timeout: 300_000, maxBuffer: 10_000_000 });
  }
}
