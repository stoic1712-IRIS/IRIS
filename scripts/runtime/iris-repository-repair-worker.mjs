/* global AbortSignal, Buffer, fetch */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  assertRepositoryRepairCheckoutContent,
  createRepositoryRepairModelSchema,
  formatRepositoryRepairModelDenial,
  repositoryRepairBootstrapCommand,
  repositoryRepairProposalSchema,
  repositoryRepairResultSchema,
  validateRepositoryRepairCandidate,
} from "../../packages/kernel/dist/repository-repair.js";

const roots = new Map([
  ["stoic1712-IRIS/IRIS", "C:\\Projects\\STOIC-IRIS-release-seven"],
  [
    "stoic1712-IRIS/iris-founder-command-center",
    "C:\\Projects\\iris-founder-command-center-release-seven",
  ],
]);
const candidateParent = "C:\\Projects\\IRIS-candidates";
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const deniedSecret =
  /(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u;
const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "core.hooksPath=NUL", "-c", "core.pager=cat", "--no-pager", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 1_048_576,
  }).trim();

function contained(parent, child) {
  const value = relative(resolve(parent), resolve(child));
  return value !== "" && !value.startsWith(`..${sep}`) && value !== "..";
}

function toWslPath(value) {
  const match = /^([A-Za-z]):\\(.*)$/u.exec(value);
  if (!match) throw new Error("UNSAFE_WINDOWS_PATH");
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function remaining(deadline, maximum = 120_000) {
  return Math.max(1, Math.min(maximum, deadline - Date.now()));
}

function runCheck(candidateRoot, changedFiles, command, deadline) {
  const started = Date.now();
  const commands = {
    "format-check": `pnpm exec prettier --check -- ${changedFiles.join(" ")}`,
    "zero-warning-lint": "pnpm lint",
    "strict-typecheck": "pnpm typecheck",
    "unit-and-integration-tests": "pnpm test",
    "production-build": "pnpm build",
    "repository-diagnostics": "pnpm diagnostics",
  };
  if (command === "dependency-integrity-check") {
    const changed = git(
      candidateRoot,
      "diff",
      "--name-only",
      "--",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
    );
    return {
      command,
      state: changed ? "failed" : "passed",
      exitCode: changed ? 1 : 0,
      durationMs: Date.now() - started,
      output: changed || "Dependency manifests and lockfile unchanged.",
    };
  }
  if (command === "secret-scan" || command === "bundle-scan") {
    const diff = git(candidateRoot, "diff", "--no-ext-diff", "--no-textconv");
    const denied =
      command === "secret-scan"
        ? /(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}|PRIVATE KEY-----/u.test(diff)
        : /GIT binary patch|Binary files .* differ/u.test(diff);
    return {
      command,
      state: denied ? "failed" : "passed",
      exitCode: denied ? 1 : 0,
      durationMs: Date.now() - started,
      output: denied ? `${command} detected denied content.` : `${command} passed.`,
    };
  }
  const shellCommand = commands[command];
  if (!shellCommand)
    return {
      command,
      state: "skipped",
      exitCode: null,
      durationMs: Date.now() - started,
      output: "Command is not available for this repository.",
    };
  const result = spawnSync(
    "wsl",
    [
      "-d",
      "Ubuntu",
      "--",
      "bash",
      "-lc",
      `source "$HOME/.nvm/nvm.sh" && cd '${toWslPath(candidateRoot)}' && ${shellCommand}`,
    ],
    {
      encoding: "utf8",
      timeout: remaining(deadline),
      maxBuffer: 1_048_576,
      windowsHide: true,
    },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(-8_192);
  return {
    command,
    state: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - started,
    output: output || (result.status === 0 ? "Passed." : "Failed."),
  };
}

async function readInput() {
  let body = "";
  for await (const chunk of process.stdin) {
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body) > 128 * 1024) throw new Error("INPUT_OVERSIZED");
  }
  return JSON.parse(body);
}

async function requestCandidate(proposal, before, context, deadline) {
  const schema = createRepositoryRepairModelSchema(proposal);
  const payload = JSON.stringify({
    model: proposal.model,
    messages: [
      {
        role: "system",
        content:
          "You are a bounded repository repair generator. Return complete replacement text only for files in the editable allowlist. Do not emit patches, shell commands, secrets, new paths, or unchanged files.",
      },
      {
        role: "user",
        content: JSON.stringify({
          defectStatement: proposal.defectStatement,
          editableFiles: before,
          readOnlyContext: context,
          verificationCommands: proposal.verificationCommands,
        }),
      },
    ],
    stream: false,
    think: false,
    format: schema,
    options: { temperature: 0 },
  });
  if (Buffer.byteLength(payload) > proposal.maximumInputBytes)
    throw new Error("MODEL_INPUT_OVERSIZED");
  const response = await fetch(`${proposal.modelEndpoint}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    redirect: "error",
    signal: AbortSignal.timeout(remaining(deadline)),
  });
  const body = await response.text();
  const responseBytes = Buffer.byteLength(body);
  if (!response.ok || responseBytes > proposal.maximumModelOutputBytes)
    throw new Error(formatRepositoryRepairModelDenial(response.status, responseBytes));
  const envelope = JSON.parse(body);
  return JSON.parse(envelope?.message?.content ?? "null");
}

let candidateRoot = "";
let sourceRoot = "";
try {
  const input = await readInput();
  const proposal = repositoryRepairProposalSchema.parse(input?.proposal);
  const deadline = Date.now() + proposal.maximumRuntimeSeconds * 1_000;
  sourceRoot = roots.get(proposal.repository) ?? "";
  if (!sourceRoot || resolve(input?.root ?? "") !== resolve(sourceRoot))
    throw new Error("REPOSITORY_DENIED");
  if (
    git(sourceRoot, "rev-parse", proposal.baseRevision) !== proposal.baseRevision ||
    git(sourceRoot, "rev-parse", "origin/main") !== proposal.expectedRemoteRevision
  )
    throw new Error("REVISION_DRIFT");

  const allPaths = [...new Set([...proposal.editableFiles, ...proposal.contextFiles])];
  let inputBytes = 0;
  const files = {};
  for (const path of allPaths) {
    const mode = git(sourceRoot, "ls-tree", proposal.baseRevision, "--", path);
    if (!/^100644 blob [a-f0-9]{40}\t/u.test(mode)) throw new Error("FILE_MODE_DENIED");
    const content = execFileSync(
      "git",
      ["--no-pager", "show", `${proposal.baseRevision}:${path}`],
      { cwd: sourceRoot, encoding: "utf8", maxBuffer: 1_048_576 },
    );
    if (content.includes("\u0000") || content.includes("\uFFFD") || deniedSecret.test(content))
      throw new Error("FILE_CONTENT_DENIED");
    inputBytes += Buffer.byteLength(content);
    files[path] = content;
  }
  if (inputBytes > proposal.maximumInputBytes) throw new Error("INPUT_OVERSIZED");
  const before = Object.fromEntries(proposal.editableFiles.map((path) => [path, files[path]]));
  const context = Object.fromEntries(proposal.contextFiles.map((path) => [path, files[path]]));
  const candidate = validateRepositoryRepairCandidate(
    await requestCandidate(proposal, before, context, deadline),
    proposal,
    before,
  );

  await mkdir(candidateParent, { recursive: true });
  const candidateId = `candidate_release-seven-${proposal.digest.slice(7, 19)}`;
  candidateRoot = join(candidateParent, candidateId);
  if (!contained(candidateParent, candidateRoot)) throw new Error("CANDIDATE_PATH_DENIED");
  try {
    await lstat(candidateRoot);
    throw new Error("CANDIDATE_ALREADY_EXISTS");
  } catch (error) {
    if (!(error instanceof Error) || !Reflect.has(error, "code")) throw error;
    if (error.code !== "ENOENT") throw error;
  }
  git(sourceRoot, "worktree", "add", "--detach", candidateRoot, proposal.baseRevision);

  const install = spawnSync(
    "wsl",
    [
      "-d",
      "Ubuntu",
      "--",
      "bash",
      "-lc",
      `source "$HOME/.nvm/nvm.sh" && cd '${toWslPath(candidateRoot)}' && pnpm install --offline --frozen-lockfile --ignore-scripts`,
    ],
    {
      encoding: "utf8",
      timeout: remaining(deadline),
      maxBuffer: 1_048_576,
      windowsHide: true,
    },
  );
  if (install.status !== 0) throw new Error("OFFLINE_INSTALL_FAILED");

  const bootstrap = spawnSync(
    "wsl",
    [
      "-d",
      "Ubuntu",
      "--",
      "bash",
      "-lc",
      `source "$HOME/.nvm/nvm.sh" && cd '${toWslPath(candidateRoot)}' && ${repositoryRepairBootstrapCommand}`,
    ],
    {
      encoding: "utf8",
      timeout: remaining(deadline),
      maxBuffer: 1_048_576,
      windowsHide: true,
    },
  );
  if (bootstrap.status !== 0) throw new Error("WORKSPACE_BOOTSTRAP_FAILED");

  for (const file of candidate.files) {
    const target = resolve(candidateRoot, file.path);
    if (!contained(candidateRoot, target)) throw new Error("WRITE_PATH_DENIED");
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("WRITE_TARGET_DENIED");
    const current = await readFile(target, "utf8");
    assertRepositoryRepairCheckoutContent(current, before[file.path]);
    await writeFile(target, file.content, { encoding: "utf8", flag: "w" });
  }
  const changed = git(candidateRoot, "diff", "--name-only", "--diff-filter=M")
    .split(/\r?\n/u)
    .filter(Boolean);
  if (
    changed.length !== candidate.files.length ||
    changed.some((path) => !candidate.files.some((file) => file.path === path))
  )
    throw new Error("UNEXPECTED_CANDIDATE_CHANGE");
  const diff = execFileSync(
    "git",
    ["--no-pager", "diff", "--no-ext-diff", "--no-textconv", "--unified=4"],
    { cwd: candidateRoot, encoding: "utf8", maxBuffer: 524_288 },
  );
  const changedLines = diff
    .split(/\r?\n/u)
    .filter(
      (line) =>
        (/^[+-]/u.test(line) && !line.startsWith("+++")) ||
        (line.startsWith("---") && !line.startsWith("--- a/")),
    ).length;
  if (changedLines > proposal.maximumChangedLines) throw new Error("CANDIDATE_CHANGE_LIMIT");
  const verification = proposal.verificationCommands.map((command) =>
    runCheck(candidateRoot, changed, command, deadline),
  );
  const verified = verification.every((item) => item.state === "passed");
  const result = repositoryRepairResultSchema.parse({
    verdict: verified ? "verified" : "needs-repair",
    summary: verified
      ? candidate.summary
      : "The candidate was generated but one or more fixed verification checks failed.",
    repository: proposal.repository,
    baseRevision: proposal.baseRevision,
    candidateId,
    diffDigest: sha256(diff),
    changedFiles: candidate.files.map((file) => ({
      path: file.path,
      beforeDigest: sha256(before[file.path]),
      afterDigest: sha256(file.content),
    })),
    diff,
    verification,
    canonicalRepositoryChanged: false,
    githubChanged: false,
    cleanupState: "completed",
    expiresAt: new Date().toISOString(),
  });
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "REPAIR_FAILED"}\n`);
  process.exitCode = 1;
} finally {
  if (candidateRoot && sourceRoot) {
    try {
      git(sourceRoot, "worktree", "remove", "--force", candidateRoot);
    } catch {
      await rm(candidateRoot, { recursive: true, force: true });
      try {
        git(sourceRoot, "worktree", "prune");
      } catch {
        // Best-effort cleanup remains confined to the validated candidate directory.
      }
    }
  }
}
