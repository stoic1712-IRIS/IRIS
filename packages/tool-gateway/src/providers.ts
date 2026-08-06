import { spawn } from "node:child_process";
import { lstat, realpath, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { z } from "zod";

import type {
  GovernedToolName,
  GovernedToolRequest,
  ToolGrant,
  ToolProvider,
  ToolProviderResult,
} from "./contracts.js";
import { assertPublicHttpsTarget } from "./network-policy.js";

const relativePathSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine((value) => !value.startsWith("/") && !/^[A-Za-z]:[\\/]/u.test(value))
  .refine((value) => !value.replaceAll("\\", "/").split("/").includes(".."));

function inside(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (path !== ".." && !path.startsWith("../") && !path.startsWith("..\\"));
}

const emptyArgumentsSchema = z.object({}).strict();

export class LocalFilesystemToolProvider implements ToolProvider {
  readonly name = "iris-local-filesystem";
  readonly tools = ["filesystem.list", "filesystem.read", "filesystem.write"] as const;
  readonly #roots: ReadonlyMap<string, { path: string; writable: boolean }>;

  constructor(roots: Record<string, { path: string; writable: boolean }>) {
    this.#roots = new Map(Object.entries(roots));
  }

  async execute(request: GovernedToolRequest, grant: ToolGrant): Promise<ToolProviderResult> {
    const [rootId, ...parts] = request.target.split("/");
    const root = this.#roots.get(rootId ?? "");
    const path = relativePathSchema.parse(parts.join("/"));
    if (root === undefined) throw new Error("FILESYSTEM_ROOT_DENIED");
    const realRoot = await realpath(root.path);
    const target = resolve(realRoot, path);
    if (!inside(realRoot, target)) throw new Error("FILESYSTEM_PATH_DENIED");
    if (request.tool === "filesystem.write") {
      if (!root.writable) throw new Error("FILESYSTEM_WRITE_DENIED");
      const parent = await realpath(dirname(target));
      if (!inside(realRoot, parent)) throw new Error("FILESYSTEM_PATH_DENIED");
      const input = z
        .object({ content: z.string().max(1_048_576), overwrite: z.boolean().default(false) })
        .strict()
        .parse(request.arguments);
      if (Buffer.byteLength(input.content) > grant.maximumResponseBytes)
        throw new Error("FILESYSTEM_WRITE_OVERSIZED");
      try {
        const existing = await lstat(target);
        if (existing.isSymbolicLink()) throw new Error("FILESYSTEM_SYMLINK_DENIED");
        const realExisting = await realpath(target);
        if (!inside(realRoot, realExisting)) throw new Error("FILESYSTEM_PATH_DENIED");
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      }
      await writeFile(target, input.content, {
        encoding: "utf8",
        flag: input.overwrite ? "w" : "wx",
      });
      return {
        status: "succeeded",
        safeSummary: "Wrote one authorized disposable-workspace file.",
        content: "",
        contentType: "text/plain",
        bytes: 0,
        externalMutation: false,
      };
    }
    const realTarget = await realpath(target);
    if (!inside(realRoot, realTarget)) throw new Error("FILESYSTEM_SYMLINK_DENIED");
    if (request.tool === "filesystem.list") {
      const entries = await readdir(realTarget, { withFileTypes: true });
      const content = JSON.stringify(
        entries.slice(0, 1_000).map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
        })),
      );
      return {
        status: "succeeded",
        safeSummary: "Listed an authorized workspace directory.",
        content,
        contentType: "application/json",
        bytes: Buffer.byteLength(content),
        externalMutation: false,
      };
    }
    const file = await stat(realTarget);
    if (!file.isFile()) throw new Error("FILESYSTEM_FILE_REQUIRED");
    if (file.size > grant.maximumResponseBytes) throw new Error("FILESYSTEM_RESPONSE_OVERSIZED");
    const content = await readFile(realTarget, "utf8");
    return {
      status: "succeeded",
      safeSummary: "Read an authorized workspace file.",
      content,
      contentType: "text/plain",
      bytes: Buffer.byteLength(content),
      externalMutation: false,
    };
  }
}

export interface ExactCommand {
  executable: string;
  args: string[];
  cwd: string;
}

export class ExactCommandToolProvider implements ToolProvider {
  readonly name = "iris-exact-command-catalog";
  readonly tools = ["process.run-exact"] as const;
  readonly #commands: ReadonlyMap<string, ExactCommand>;

  constructor(commands: Record<string, ExactCommand>) {
    this.#commands = new Map(Object.entries(commands));
  }

  execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult> {
    emptyArgumentsSchema.parse(request.arguments);
    const command = this.#commands.get(request.target);
    if (command === undefined) return Promise.reject(new Error("COMMAND_NOT_ALLOWLISTED"));
    return new Promise((resolveResult, rejectResult) => {
      const environment = {
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot ?? "",
      };
      const child = spawn(command.executable, command.args, {
        cwd: command.cwd,
        env: environment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      let errorOutput = "";
      const collect = (current: string, chunk: Buffer) => {
        const next = current + chunk.toString("utf8");
        if (Buffer.byteLength(next) > grant.maximumResponseBytes) child.kill("SIGTERM");
        return next;
      };
      child.stdout.on("data", (chunk: Buffer) => {
        output = collect(output, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        errorOutput = collect(errorOutput, chunk);
      });
      const abort = () => child.kill("SIGTERM");
      signal.addEventListener("abort", abort, { once: true });
      child.once("error", rejectResult);
      child.once("exit", (code) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) {
          rejectResult(new Error("COMMAND_TIMEOUT"));
          return;
        }
        const content = code === 0 ? output : errorOutput;
        if (Buffer.byteLength(content) > grant.maximumResponseBytes) {
          rejectResult(new Error("COMMAND_OUTPUT_OVERSIZED"));
          return;
        }
        resolveResult({
          status: code === 0 ? "succeeded" : "failed",
          safeSummary:
            code === 0
              ? "Exact allowlisted command completed."
              : "Exact allowlisted command failed.",
          content,
          contentType: "text/plain",
          bytes: Buffer.byteLength(content),
          externalMutation: false,
        });
      });
    });
  }
}

export class HttpsFetchToolProvider implements ToolProvider {
  readonly name = "iris-bounded-https";
  readonly tools = ["network.fetch-https"] as const;
  readonly #fetch: typeof fetch;

  constructor(fetchImplementation: typeof fetch = fetch) {
    this.#fetch = fetchImplementation;
  }

  async execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult> {
    emptyArgumentsSchema.parse(request.arguments);
    const url = new URL(request.target);
    assertPublicHttpsTarget(url, grant.allowedHosts);
    const response = await this.#fetch(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      headers: { accept: "text/html,application/json,text/plain" },
      signal,
    });
    if (!response.ok) throw new Error("NETWORK_RESPONSE_DENIED");
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > grant.maximumResponseBytes) throw new Error("NETWORK_RESPONSE_OVERSIZED");
    if (response.body === null) throw new Error("NETWORK_RESPONSE_EMPTY");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > grant.maximumResponseBytes) {
        await reader.cancel();
        throw new Error("NETWORK_RESPONSE_OVERSIZED");
      }
      chunks.push(next.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const content = new TextDecoder("utf-8", { fatal: true }).decode(body);
    return {
      status: "succeeded",
      safeSummary: "Fetched one authorized HTTPS resource.",
      content,
      contentType: response.headers.get("content-type")?.split(";", 1)[0] ?? "text/plain",
      bytes,
      externalMutation: false,
    };
  }
}

export interface GithubRepositoryGatewayDelegate {
  inspectRepository(repository: string): {
    repository: string;
    visibility: "PUBLIC" | "PRIVATE" | "INTERNAL";
    defaultBranch: string;
  };
  push(input: {
    repository: string;
    ref: string;
    commit: string;
    force: false;
    authorization: {
      operation: "push-branch";
      repository: string;
      target: string;
      approvalDigest: string;
    };
  }): Promise<{ remoteCommit: string }>;
  createPullRequest(input: {
    repository: string;
    base: "main";
    head: string;
    title: string;
    body: string;
    draft: true;
    maintainersCanModify: false;
    headCommit: string;
    authorization: {
      operation: "create-pull-request";
      repository: string;
      target: string;
      approvalDigest: string;
    };
  }): Promise<{ number: number; url: string; draft: true; headCommit: string }>;
  mergePullRequest(input: {
    repository: string;
    number: number;
    expectedHeadCommit: string;
    authorization: {
      operation: "merge-pull-request";
      repository: string;
      target: string;
      approvalDigest: string;
    };
  }): Promise<{ mergeCommit: string }>;
}

const commitSchema = z.string().regex(/^[a-f0-9]{40}$/u);
const referenceSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u)
  .refine((value) => !value.includes("..") && !value.endsWith("/"));

function githubTarget(target: string): { repository: string; selector?: string } {
  const [owner, name, ...rest] = target.split("/");
  if (owner === undefined || name === undefined) throw new Error("GITHUB_TARGET_INVALID");
  return {
    repository: `${owner}/${name}`,
    ...(rest.length === 0 ? {} : { selector: rest.join("/") }),
  };
}

export class GithubToolProvider implements ToolProvider {
  readonly name = "iris-governed-github";
  readonly tools = [
    "github.inspect",
    "github.push-branch",
    "github.create-pull-request",
    "github.merge-pull-request",
  ] as const;
  readonly #delegate: GithubRepositoryGatewayDelegate;

  constructor(delegate: GithubRepositoryGatewayDelegate) {
    this.#delegate = delegate;
  }

  async execute(request: GovernedToolRequest): Promise<ToolProviderResult> {
    const { repository, selector } = githubTarget(request.target);
    if (request.tool === "github.inspect") {
      emptyArgumentsSchema.parse(request.arguments);
      if (selector !== undefined) throw new Error("GITHUB_TARGET_INVALID");
      const content = JSON.stringify(this.#delegate.inspectRepository(repository));
      return this.#result("Inspected one authorized GitHub repository.", content, false);
    }
    const approvalDigest = request.authorization?.requestDigest;
    if (approvalDigest === undefined) throw new Error("GITHUB_AUTHORIZATION_REQUIRED");
    if (request.tool === "github.push-branch") {
      const ref = referenceSchema.parse(selector);
      const input = z.object({ commit: commitSchema }).strict().parse(request.arguments);
      const content = JSON.stringify(
        await this.#delegate.push({
          repository,
          ref,
          commit: input.commit,
          force: false,
          authorization: {
            operation: "push-branch",
            repository,
            target: ref,
            approvalDigest,
          },
        }),
      );
      return this.#result("Pushed one exact authorized branch commit.", content, true);
    }
    if (request.tool === "github.create-pull-request") {
      const head = referenceSchema.parse(selector);
      const input = z
        .object({
          title: z.string().min(1).max(200),
          body: z.string().max(20_000),
          headCommit: commitSchema,
        })
        .strict()
        .parse(request.arguments);
      const content = JSON.stringify(
        await this.#delegate.createPullRequest({
          repository,
          base: "main",
          head,
          title: input.title,
          body: input.body,
          draft: true,
          maintainersCanModify: false,
          headCommit: input.headCommit,
          authorization: {
            operation: "create-pull-request",
            repository,
            target: head,
            approvalDigest,
          },
        }),
      );
      return this.#result("Created one exact authorized draft pull request.", content, true);
    }
    const number = z.coerce.number().int().positive().parse(selector);
    const input = z.object({ expectedHeadCommit: commitSchema }).strict().parse(request.arguments);
    const content = JSON.stringify(
      await this.#delegate.mergePullRequest({
        repository,
        number,
        expectedHeadCommit: input.expectedHeadCommit,
        authorization: {
          operation: "merge-pull-request",
          repository,
          target: String(number),
          approvalDigest,
        },
      }),
    );
    return this.#result("Merged one exact authorized pull request.", content, true);
  }

  #result(safeSummary: string, content: string, externalMutation: boolean): ToolProviderResult {
    return {
      status: "succeeded",
      safeSummary,
      content,
      contentType: "application/json",
      bytes: Buffer.byteLength(content),
      externalMutation,
    };
  }
}

export class DelegatingToolProvider implements ToolProvider {
  readonly name: string;
  readonly tools: readonly GovernedToolName[];
  readonly #delegate: ToolProvider["execute"];

  constructor(options: {
    name: string;
    tools: GovernedToolName[];
    execute: ToolProvider["execute"];
  }) {
    this.name = options.name;
    this.tools = options.tools;
    this.#delegate = options.execute;
  }

  execute(
    request: GovernedToolRequest,
    grant: ToolGrant,
    signal: AbortSignal,
  ): Promise<ToolProviderResult> {
    return this.#delegate(request, grant, signal);
  }
}
