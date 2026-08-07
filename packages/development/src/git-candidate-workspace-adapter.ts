import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  executableWorkerCheckSchema,
  executableWorkerPreflightSchema,
  type ExecutableWorkerCheck,
  type ExecutableWorkerPreflight,
  type ExecutableWorkerProposal,
} from "./executable-worker-contracts.js";
import type { ExecutableWorkerAdapter } from "./executable-worker-runtime.js";
import type { ExecutableWorkerWorkspace } from "./execution-journal.js";

const executeFile = promisify(execFile);

function digestText(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function within(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => path === root || path.startsWith(`${root.replace(/\/$/u, "")}/`));
}

function truncateUtf8(value: string, maximumBytes: number): string {
  if (maximumBytes <= 0) return "";
  if (Buffer.byteLength(value) <= maximumBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle)) <= maximumBytes) low = middle;
    else high = middle - 1;
  }
  if (low > 0 && /[\uD800-\uDBFF]/u.test(value[low - 1] ?? "")) low -= 1;
  return value.slice(0, low);
}

function porcelainPaths(output: string): string[] {
  const records = output.split("\0");
  const paths: string[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== " ")
      throw new Error("EXECUTABLE_WORKER_GIT_STATUS_INVALID");
    const status = record.slice(0, 2);
    paths.push(record.slice(3).replaceAll("\\", "/"));
    if (/[RC]/u.test(status)) {
      const source = records[index + 1];
      if (!source) throw new Error("EXECUTABLE_WORKER_GIT_STATUS_INVALID");
      paths.push(source.replaceAll("\\", "/"));
      index += 1;
    }
  }
  return paths;
}

export class GitCandidateWorkspaceAdapter implements ExecutableWorkerAdapter {
  readonly #canonicalPath: string;
  readonly #gitExecutable: string;
  readonly #maximumContextBytes: number;
  readonly #workspaceRoot: string;

  constructor(options: {
    canonicalPath: string;
    gitExecutable?: string;
    maximumContextBytes?: number;
    workspaceRoot?: string;
  }) {
    this.#canonicalPath = resolve(options.canonicalPath);
    this.#gitExecutable = options.gitExecutable ?? "git";
    this.#maximumContextBytes = options.maximumContextBytes ?? 256 * 1024;
    this.#workspaceRoot = resolve(options.workspaceRoot ?? tmpdir());
  }

  async preflight(proposal: ExecutableWorkerProposal): Promise<ExecutableWorkerPreflight> {
    const checks: ExecutableWorkerPreflight["checks"] = [];
    const status = await this.#git(["status", "--porcelain=v1", "-uall"], this.#canonicalPath);
    checks.push({
      capability: "clean-canonical-worktree",
      status: status.stdout.trim() === "" ? "ready" : "blocked",
      detail:
        status.stdout.trim() === ""
          ? "Canonical worktree is clean."
          : "Canonical worktree contains uncommitted changes.",
    });
    const head = (await this.#git(["rev-parse", "HEAD"], this.#canonicalPath)).stdout.trim();
    checks.push({
      capability: "exact-base-revision",
      status: head === proposal.baseRevision ? "ready" : "blocked",
      detail:
        head === proposal.baseRevision
          ? `Base revision ${head} is exact.`
          : `Expected ${proposal.baseRevision}; found ${head}.`,
    });
    const remote = await this.#git(["remote", "get-url", "origin"], this.#canonicalPath)
      .then((result) => result.stdout.trim())
      .catch(() => "");
    const remoteSlug = /(?:github\.com[/:])([^/]+\/[^/]+)$/u.exec(
      remote.replace(/\.git$/u, ""),
    )?.[1];
    checks.push({
      capability: "exact-canonical-repository",
      status: remoteSlug === proposal.repository ? "ready" : "blocked",
      detail:
        remoteSlug === proposal.repository
          ? `Origin is exactly ${proposal.repository}.`
          : `Expected origin ${proposal.repository}; found ${remoteSlug ?? "none"}.`,
    });
    const branchExists = await this.#refExists(`refs/heads/${proposal.branch}`);
    checks.push({
      capability: "unique-candidate-branch",
      status: branchExists ? "blocked" : "ready",
      detail: branchExists
        ? `Candidate branch ${proposal.branch} already exists.`
        : `Candidate branch ${proposal.branch} is available.`,
    });
    for (const command of [...proposal.materializationCommands, ...proposal.commands]) {
      const executable = command[0];
      if (executable === undefined) continue;
      const available = await this.#executableAvailable(executable);
      checks.push({
        capability: `command:${executable}`,
        status: available ? "ready" : "blocked",
        detail: available
          ? `Executable ${executable} is available.`
          : `Executable ${executable} is unavailable.`,
      });
    }
    return executableWorkerPreflightSchema.parse({
      ready: checks.every((check) => check.status === "ready"),
      checks,
    });
  }

  async createWorkspace(proposal: ExecutableWorkerProposal): Promise<ExecutableWorkerWorkspace> {
    await mkdir(this.#workspaceRoot, { recursive: true });
    const path = await mkdtemp(join(this.#workspaceRoot, "iris-executable-worker-"));
    await rm(path, { recursive: true, force: true });
    await this.#git(
      ["worktree", "add", "--detach", path, proposal.baseRevision],
      this.#canonicalPath,
    );
    return {
      id: `workspace_${proposal.executionId}`,
      path,
      baseRevision: proposal.baseRevision,
      disposable: true,
    };
  }

  async workspaceExists(workspace: ExecutableWorkerWorkspace): Promise<boolean> {
    try {
      await access(workspace.path);
      return true;
    } catch {
      return false;
    }
  }

  async context(
    workspace: ExecutableWorkerWorkspace,
    proposal: ExecutableWorkerProposal,
  ): Promise<string> {
    const files = (await this.#git(["ls-files"], workspace.path)).stdout
      .split(/\r?\n/u)
      .filter((path) => path !== "" && within(path, proposal.readPaths))
      .slice(0, 500);
    const sections: string[] = [];
    let bytes = 0;
    const append = (section: string) => {
      const bounded = truncateUtf8(section, this.#maximumContextBytes - bytes);
      if (bounded === "") return;
      sections.push(bounded);
      bytes += Buffer.byteLength(bounded);
    };
    append(`Repository files:\n${files.join("\n")}`);
    for (const path of files) {
      if (bytes >= this.#maximumContextBytes) break;
      try {
        const content = await readFile(await this.#resolveSafe(workspace, path), "utf8");
        append(`\n--- ${path} ---\n${content}`);
      } catch {
        append(`\n--- ${path} ---\n[BINARY OR UNREADABLE]`);
      }
    }
    return sections.join("");
  }

  async diff(workspace: ExecutableWorkerWorkspace): Promise<string> {
    const tracked = (await this.#git(["diff", "--no-ext-diff", "--binary", "HEAD"], workspace.path))
      .stdout;
    const untracked = (
      await this.#git(["ls-files", "--others", "--exclude-standard"], workspace.path)
    ).stdout
      .split(/\r?\n/u)
      .filter(Boolean);
    const additions: string[] = [];
    for (const path of untracked) {
      const content = await readFile(await this.#resolveSafe(workspace, path), "utf8");
      additions.push(
        `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n${content}`,
      );
    }
    return `${tracked}${additions.join("\n")}`.slice(0, 1_000_000);
  }

  async readFile(workspace: ExecutableWorkerWorkspace, path: string): Promise<string | null> {
    try {
      return await readFile(await this.#resolveSafe(workspace, path), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async writeFile(
    workspace: ExecutableWorkerWorkspace,
    path: string,
    content: string,
  ): Promise<void> {
    const target = await this.#resolveSafe(workspace, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async deleteFile(workspace: ExecutableWorkerWorkspace, path: string): Promise<void> {
    await unlink(await this.#resolveSafe(workspace, path));
  }

  async run(
    workspace: ExecutableWorkerWorkspace,
    command: string[],
    signal: AbortSignal,
  ): Promise<ExecutableWorkerCheck> {
    const executable = command[0];
    if (executable === undefined) throw new Error("EXECUTABLE_WORKER_COMMAND_EMPTY");
    let exitCode = 0;
    let output: string;
    try {
      const result = await executeFile(executable, command.slice(1), {
        cwd: workspace.path,
        timeout: 300_000,
        maxBuffer: 64_000,
        signal,
      });
      output = `${result.stdout}${result.stderr}`;
    } catch (error) {
      const failure = error as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      exitCode = typeof failure.code === "number" ? failure.code : 1;
      output = `${failure.stdout ?? ""}${failure.stderr ?? ""}${failure.message ?? ""}`;
    }
    output = output.slice(0, 64_000);
    return executableWorkerCheckSchema.parse({
      command,
      exitCode,
      output,
      outputDigest: digestText(output),
    });
  }

  async changedPaths(workspace: ExecutableWorkerWorkspace): Promise<string[]> {
    return porcelainPaths(
      (await this.#git(["status", "--porcelain=v1", "-z", "-uall"], workspace.path)).stdout,
    ).sort();
  }

  async checkpoint(
    workspace: ExecutableWorkerWorkspace,
    proposal: ExecutableWorkerProposal,
    changedPaths: string[],
  ): Promise<{ commit: string; ref: string; diff: string }> {
    const diff = await this.diff(workspace);
    await this.#git(["switch", "-c", proposal.branch], workspace.path);
    await this.#git(["add", "--", ...changedPaths], workspace.path);
    await this.#git(
      [
        "-c",
        "user.name=IRIS Executable Worker",
        "-c",
        "user.email=iris@local.invalid",
        "commit",
        "-m",
        `feat: ${proposal.objective.slice(0, 120)}`,
      ],
      workspace.path,
    );
    const commit = (await this.#git(["rev-parse", "HEAD"], workspace.path)).stdout.trim();
    return { commit, ref: `refs/heads/${proposal.branch}`, diff };
  }

  async cleanup(workspace: ExecutableWorkerWorkspace): Promise<boolean> {
    try {
      await this.#git(["worktree", "remove", "--force", workspace.path], this.#canonicalPath);
      await this.#git(["worktree", "prune"], this.#canonicalPath);
      await rm(workspace.path, { recursive: true, force: true });
      return !(await this.workspaceExists(workspace));
    } catch {
      return false;
    }
  }

  #resolve(workspace: ExecutableWorkerWorkspace, path: string): string {
    const target = resolve(workspace.path, path);
    if (target !== workspace.path && !target.startsWith(`${workspace.path}${sep}`))
      throw new Error("EXECUTABLE_WORKER_PATH_ESCAPE");
    return target;
  }

  async #resolveSafe(workspace: ExecutableWorkerWorkspace, path: string): Promise<string> {
    const target = this.#resolve(workspace, path);
    let current = workspace.path;
    for (const part of path.replaceAll("\\", "/").split("/").filter(Boolean)) {
      current = join(current, part);
      try {
        if ((await lstat(current)).isSymbolicLink())
          throw new Error(`EXECUTABLE_WORKER_SYMLINK_DENIED:${path}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
        throw error;
      }
    }
    return target;
  }

  async #refExists(ref: string): Promise<boolean> {
    try {
      await this.#git(["show-ref", "--verify", "--quiet", ref], this.#canonicalPath);
      return true;
    } catch {
      return false;
    }
  }

  async #executableAvailable(executable: string): Promise<boolean> {
    try {
      await executeFile(process.platform === "win32" ? "where.exe" : "which", [executable], {
        timeout: 5_000,
        maxBuffer: 8_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  #git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    const exactArgs = this.#gitExecutable.toLowerCase().endsWith("git.exe")
      ? args.map((argument) => this.#windowsPath(argument))
      : args;
    return executeFile(this.#gitExecutable, exactArgs, {
      cwd,
      timeout: 300_000,
      maxBuffer: 10_000_000,
    });
  }

  #windowsPath(value: string): string {
    const match = /^\/mnt\/([a-z])\/(.*)$/iu.exec(value);
    return match?.[1] === undefined || match[2] === undefined
      ? value
      : `${match[1].toUpperCase()}:/${match[2]}`;
  }
}
