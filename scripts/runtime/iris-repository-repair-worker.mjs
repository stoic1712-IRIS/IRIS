/* global AbortController, Buffer, clearTimeout, fetch, setTimeout, TextDecoder */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import {
  assertRepositoryRepairCheckoutContent,
  assertRepositoryRepairCleanupState,
  createRepositoryRepairIdleDeadline,
  createRepositoryRepairScopeDigest,
  createRepositoryRepairStageModelSchema,
  createRepositoryRepairStagePacket,
  formatRepositoryRepairModelDenial,
  repositoryRepairBootstrapCommand,
  repositoryRepairJournalSchema,
  repositoryRepairProposalSchema,
  repositoryRepairResultSchema,
  validateRepositoryRepairResume,
  validateRepositoryRepairStageCandidate,
  validateRepositoryRepairWorkingSet,
} from "../../packages/kernel/dist/repository-repair.js";

const roots = new Map([
  ["stoic1712-IRIS/IRIS", process.env.IRIS_ROOT],
  ["stoic1712-IRIS/iris-founder-command-center", process.env.IRIS_COMMAND_CENTER_ROOT],
]);
const candidateParent = "C:\\Projects\\IRIS-candidates";
const journalSuffix = ".iris-repair-journal.json";
const candidatePattern = /^candidate_release-seven-[a-f0-9]{12}$/u;
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

function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : "REPAIR_FAILED";
  const safe = /^(?:[A-Z][A-Z0-9_]*|MODEL_OUTPUT_DENIED status=\d{3} bytes=\d+)$/u.exec(message);
  return safe?.[0] ?? "REPAIR_FAILED";
}

function emitProgress({
  stageIndex,
  targetPath,
  state,
  startedAt,
  inputBytes = 0,
  outputBytes = 0,
  errorCode,
}) {
  const event = {
    type: "REPAIR_PROGRESS",
    stageIndex,
    targetPath,
    state,
    elapsedMs: Math.max(0, Date.now() - startedAt),
    inputBytes,
    outputBytes,
    ...(errorCode ? { errorCode } : {}),
  };
  process.stderr.write(`REPAIR_PROGRESS ${JSON.stringify(event)}\n`);
}

function runCheck(candidateRoot, changedFiles, command, timeoutMs) {
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
      timeout: timeoutMs,
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

async function writeJournal(path, value) {
  const parsed = repositoryRepairJournalSchema.parse(value);
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(parsed)}\n`, { encoding: "utf8", flag: "w" });
  await rename(temporary, path);
}

async function requestStage(proposal, packet) {
  const schema = createRepositoryRepairStageModelSchema(proposal);
  const payload = JSON.stringify({
    model: proposal.model,
    messages: [
      {
        role: "system",
        content:
          "You are a bounded repository repair generator. Return exact before/after edits only for the active target path, or request more allowlisted repository context. Never emit full files, patches, commands, secrets, new paths, approvals, or authority.",
      },
      { role: "user", content: JSON.stringify(packet) },
    ],
    stream: true,
    think: false,
    format: schema,
    options: { temperature: 0 },
  });
  const inputBytes = Buffer.byteLength(payload);
  if (inputBytes > proposal.maximumInputBytes) throw new Error("MODEL_INPUT_OVERSIZED");

  const controller = new AbortController();
  let idleTimer;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    const idleDeadline = createRepositoryRepairIdleDeadline(proposal, Date.now());
    idleTimer = setTimeout(() => controller.abort(), Math.max(1, idleDeadline - Date.now()));
  };
  resetIdleTimer();
  try {
    const response = await fetch(`${proposal.modelEndpoint}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const deniedBody = await response.text();
      throw new Error(
        formatRepositoryRepairModelDenial(response.status, Buffer.byteLength(deniedBody)),
      );
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let content = "";
    let wireBytes = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      resetIdleTimer();
      wireBytes += item.value.byteLength;
      if (wireBytes > proposal.maximumModelOutputBytes * 4)
        throw new Error("MODEL_OUTPUT_OVERSIZED");
      pending += decoder.decode(item.value, { stream: true });
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const envelope = JSON.parse(line);
        content += typeof envelope?.message?.content === "string" ? envelope.message.content : "";
        if (Buffer.byteLength(content) > proposal.maximumModelOutputBytes)
          throw new Error("MODEL_OUTPUT_OVERSIZED");
      }
    }
    pending += decoder.decode();
    if (pending.trim()) {
      const envelope = JSON.parse(pending);
      content += typeof envelope?.message?.content === "string" ? envelope.message.content : "";
    }
    const outputBytes = Buffer.byteLength(content);
    if (outputBytes === 0 || outputBytes > proposal.maximumModelOutputBytes)
      throw new Error("MODEL_OUTPUT_OVERSIZED");
    return {
      value: JSON.parse(content),
      outputDigest: sha256(content),
      inputBytes,
      outputBytes,
    };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("MODEL_IDLE_TIMEOUT");
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
}

async function readCandidateFiles(candidateRoot, paths) {
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => {
        const target = resolve(candidateRoot, path);
        if (!contained(candidateRoot, target)) throw new Error("READ_PATH_DENIED");
        const metadata = await lstat(target);
        if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("FILE_MODE_DENIED");
        return [path, await readFile(target, "utf8")];
      }),
    ),
  );
}

function gitNulPaths(candidateRoot, ...args) {
  return execFileSync(
    "git",
    ["-c", "core.hooksPath=NUL", "-c", "core.pager=cat", "--no-pager", ...args],
    { cwd: candidateRoot, encoding: "utf8", maxBuffer: 1_048_576 },
  )
    .split("\0")
    .filter(Boolean);
}

function changedPaths(candidateRoot) {
  const tracked = gitNulPaths(candidateRoot, "diff", "--name-only", "--no-renames", "-z");
  const staged = gitNulPaths(
    candidateRoot,
    "diff",
    "--cached",
    "--name-only",
    "--no-renames",
    "-z",
  );
  const untracked = gitNulPaths(candidateRoot, "ls-files", "--others", "--exclude-standard", "-z");
  return [...new Set([...tracked, ...staged, ...untracked])];
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && Reflect.has(error, "code") && error.code === "ENOENT")
      return false;
    throw error;
  }
}

async function cleanupCandidate(sourceRoot, candidateRoot, journalPath) {
  if (!contained(candidateParent, candidateRoot)) throw new Error("CANDIDATE_PATH_DENIED");
  try {
    git(sourceRoot, "worktree", "remove", "--force", candidateRoot);
  } catch {
    await rm(candidateRoot, { recursive: true, force: true });
    git(sourceRoot, "worktree", "prune");
  }
  try {
    await unlink(journalPath);
  } catch (error) {
    if (!(error instanceof Error) || !Reflect.has(error, "code") || error.code !== "ENOENT")
      throw error;
  }
  return assertRepositoryRepairCleanupState(
    await pathExists(candidateRoot),
    await pathExists(journalPath),
  );
}

async function findRetainedCandidate(sourceRoot, proposal) {
  const names = await readdir(candidateParent).catch(() => []);
  for (const name of names.sort()) {
    if (!name.endsWith(journalSuffix)) continue;
    const journalPath = join(candidateParent, name);
    let journal;
    try {
      journal = repositoryRepairJournalSchema.parse(
        JSON.parse(await readFile(journalPath, "utf8")),
      );
    } catch {
      continue;
    }
    if (!candidatePattern.test(journal.candidateId)) continue;
    const candidateRoot = join(candidateParent, journal.candidateId);
    if (!contained(candidateParent, candidateRoot)) continue;
    const stale =
      Date.now() - Date.parse(journal.lastProgressAt) > proposal.maximumRetentionSeconds * 1_000;
    if (stale) {
      const journalRoot = roots.get(journal.repository);
      if (typeof journalRoot === "string" && journalRoot.length > 0)
        await cleanupCandidate(resolve(journalRoot), candidateRoot, journalPath).catch(
          () => undefined,
        );
      continue;
    }
    try {
      const metadata = await lstat(candidateRoot);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) continue;
      const currentFiles = await readCandidateFiles(candidateRoot, [
        ...new Set([...proposal.editableFiles, ...proposal.contextFiles]),
      ]);
      const resume = validateRepositoryRepairResume({
        proposal,
        journal,
        candidateHead: git(candidateRoot, "rev-parse", "HEAD"),
        currentFiles,
        changedPaths: changedPaths(candidateRoot),
      });
      return { candidateRoot, journalPath, journal, nextStageIndex: resume.nextStageIndex };
    } catch {
      // An incompatible retained candidate remains isolated until its own retention limit.
    }
  }
  return null;
}

async function ensureCandidateWorkspace(candidateRoot, timeoutMs) {
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
      timeout: timeoutMs,
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
      timeout: timeoutMs,
      maxBuffer: 1_048_576,
      windowsHide: true,
    },
  );
  if (bootstrap.status !== 0) throw new Error("WORKSPACE_BOOTSTRAP_FAILED");
}

let candidateRoot = "";
let journalPath = "";
let sourceRoot = "";
let retainCandidate = false;
let journal = null;
try {
  const input = await readInput();
  const proposal = repositoryRepairProposalSchema.parse(input?.proposal);
  const operationTimeoutMs = proposal.maximumRuntimeSeconds * 1_000;
  const configuredRoot = roots.get(proposal.repository);
  sourceRoot =
    typeof configuredRoot === "string" && configuredRoot.length > 0 ? resolve(configuredRoot) : "";
  if (!sourceRoot || resolve(input?.root ?? "") !== resolve(sourceRoot))
    throw new Error("REPOSITORY_DENIED");
  if (
    git(sourceRoot, "rev-parse", proposal.baseRevision) !== proposal.baseRevision ||
    git(sourceRoot, "rev-parse", "origin/main") !== proposal.expectedRemoteRevision
  )
    throw new Error("REVISION_DRIFT");

  const allPaths = [...new Set([...proposal.editableFiles, ...proposal.contextFiles])];
  const canonicalFiles = {};
  for (const path of allPaths) {
    const mode = git(sourceRoot, "ls-tree", proposal.baseRevision, "--", path);
    if (!/^100644 blob [a-f0-9]{40}\t/u.test(mode)) throw new Error("FILE_MODE_DENIED");
    const content = execFileSync(
      "git",
      ["--no-pager", "show", `${proposal.baseRevision}:${path}`],
      {
        cwd: sourceRoot,
        encoding: "utf8",
        maxBuffer: proposal.maximumInputBytes + 1,
      },
    );
    if (
      Buffer.byteLength(content) > proposal.maximumInputBytes ||
      content.includes("\u0000") ||
      content.includes("\uFFFD") ||
      deniedSecret.test(content)
    )
      throw new Error("FILE_CONTENT_DENIED");
    canonicalFiles[path] = content;
  }

  await mkdir(candidateParent, { recursive: true });
  const retained = await findRetainedCandidate(sourceRoot, proposal);
  let nextStageIndex = 0;
  if (retained) {
    ({ candidateRoot, journalPath, journal, nextStageIndex } = retained);
  } else {
    const candidateId = `candidate_release-seven-${proposal.digest.slice(7, 19)}`;
    candidateRoot = join(candidateParent, candidateId);
    journalPath = join(candidateParent, `${candidateId}${journalSuffix}`);
    if (!contained(candidateParent, candidateRoot)) throw new Error("CANDIDATE_PATH_DENIED");
    try {
      await lstat(candidateRoot);
      throw new Error("CANDIDATE_ALREADY_EXISTS");
    } catch (error) {
      if (!(error instanceof Error) || !Reflect.has(error, "code") || error.code !== "ENOENT")
        throw error;
    }
    git(sourceRoot, "worktree", "add", "--detach", candidateRoot, proposal.baseRevision);
    journal = repositoryRepairJournalSchema.parse({
      schemaVersion: 1,
      scopeDigest: createRepositoryRepairScopeDigest(proposal),
      repository: proposal.repository,
      baseRevision: proposal.baseRevision,
      expectedRemoteRevision: proposal.expectedRemoteRevision,
      candidateId,
      candidateHead: proposal.baseRevision,
      canonicalBeforeDigests: Object.fromEntries(
        allPaths.map((path) => [path, sha256(canonicalFiles[path])]),
      ),
      completedStages: [],
      contextSlices: [],
      lastProgressAt: new Date().toISOString(),
      state: "active",
    });
    await writeJournal(journalPath, journal);
  }
  retainCandidate = true;
  await ensureCandidateWorkspace(candidateRoot, operationTimeoutMs);

  const summaries = [];
  for (const [stageIndex, targetPath] of proposal.editableFiles.entries()) {
    if (stageIndex < nextStageIndex) continue;
    const startedAt = Date.now();
    const priorRequests = [];
    let stageComplete = false;
    emitProgress({ stageIndex, targetPath, state: "started", startedAt });
    for (let contextRound = 0; contextRound < 6; contextRound++) {
      const currentFiles = await readCandidateFiles(candidateRoot, allPaths);
      validateRepositoryRepairWorkingSet({ proposal, journal, currentFiles });
      const packet = createRepositoryRepairStagePacket({
        proposal,
        targetPath,
        files: currentFiles,
        priorRequests,
        maximumBytes: Math.min(proposal.maximumInputBytes, 96 * 1024),
      });
      const response = await requestStage(proposal, packet);
      const stage = validateRepositoryRepairStageCandidate(
        response.value,
        proposal,
        targetPath,
        currentFiles,
      );
      emitProgress({
        stageIndex,
        targetPath,
        state: stage.kind === "context-request" ? "context-requested" : "generated",
        startedAt,
        inputBytes: response.inputBytes,
        outputBytes: response.outputBytes,
      });
      if (stage.kind === "context-request") {
        const existing = new Set(
          priorRequests.map((request) => `${request.path}\n${request.query}`),
        );
        const additions = stage.requests.filter(
          (request) => !existing.has(`${request.path}\n${request.query}`),
        );
        if (additions.length === 0) throw new Error("CONTEXT_REQUEST_STALLED");
        priorRequests.push(...additions);
        continue;
      }
      const file = stage.files[0];
      if (!file) throw new Error("STAGE_EMPTY_DENIED");
      const target = resolve(candidateRoot, file.path);
      if (!contained(candidateRoot, target)) throw new Error("WRITE_PATH_DENIED");
      const metadata = await lstat(target);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("WRITE_TARGET_DENIED");
      const current = await readFile(target, "utf8");
      assertRepositoryRepairCheckoutContent(current, currentFiles[file.path]);
      await writeFile(target, file.content, { encoding: "utf8", flag: "w" });
      journal = repositoryRepairJournalSchema.parse({
        ...journal,
        completedStages: [
          ...journal.completedStages,
          {
            index: stageIndex,
            path: targetPath,
            afterDigest: sha256(file.content),
            modelOutputDigest: response.outputDigest,
            completedAt: new Date().toISOString(),
          },
        ],
        contextSlices: [
          ...journal.contextSlices,
          ...packet.slices.map(({ content: _content, ...slice }) => slice),
        ].slice(-240),
        lastProgressAt: new Date().toISOString(),
        state: "active",
      });
      await writeJournal(journalPath, journal);
      summaries.push(stage.summary);
      stageComplete = true;
      emitProgress({
        stageIndex,
        targetPath,
        state: "checkpointed",
        startedAt,
        inputBytes: response.inputBytes,
        outputBytes: response.outputBytes,
      });
      break;
    }
    if (!stageComplete) throw new Error("CONTEXT_REQUEST_LIMIT");
  }

  const changed = changedPaths(candidateRoot);
  if (
    changed.length !== proposal.editableFiles.length ||
    changed.some((path) => !proposal.editableFiles.includes(path))
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
    runCheck(candidateRoot, changed, command, operationTimeoutMs),
  );
  const verified = verification.every((item) => item.state === "passed");
  const finalFiles = await readCandidateFiles(candidateRoot, proposal.editableFiles);
  const cleanupState = await cleanupCandidate(sourceRoot, candidateRoot, journalPath);
  candidateRoot = "";
  journalPath = "";
  retainCandidate = false;
  const result = repositoryRepairResultSchema.parse({
    verdict: verified ? "verified" : "needs-repair",
    summary: verified
      ? summaries.join(" ") || "All retained stages and fixed verification checks passed."
      : "The staged candidate was generated but one or more fixed verification checks failed.",
    repository: proposal.repository,
    baseRevision: proposal.baseRevision,
    candidateId: journal.candidateId,
    diffDigest: sha256(diff),
    changedFiles: proposal.editableFiles.map((path) => ({
      path,
      beforeDigest: sha256(canonicalFiles[path]),
      afterDigest: sha256(finalFiles[path]),
    })),
    diff,
    verification,
    canonicalRepositoryChanged: false,
    githubChanged: false,
    cleanupState,
    expiresAt: new Date().toISOString(),
  });
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  const errorCode = safeErrorCode(error);
  if (retainCandidate && journal && journalPath) {
    journal = repositoryRepairJournalSchema.parse({
      ...journal,
      lastProgressAt: new Date().toISOString(),
      state: "failed",
    });
    await writeJournal(journalPath, journal).catch(() => undefined);
  }
  emitProgress({
    stageIndex: journal?.completedStages.length ?? 0,
    targetPath: "",
    state: "failed",
    startedAt: Date.now(),
    errorCode,
  });
  process.stderr.write(`${errorCode}\n`);
  process.exitCode = 1;
}
