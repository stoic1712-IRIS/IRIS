import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const serviceUrls = {
  gateway: "http://127.0.0.1:4174/v1/health",
  voice: "http://127.0.0.1:8765/health",
  search: "http://127.0.0.1:8888/",
  ollama: "http://127.0.0.1:11434/api/tags",
};
const founderStartupPollMilliseconds = 500;
const founderStartupTimeoutMilliseconds = 120_000;
const founderStartupAttempts = Math.ceil(
  founderStartupTimeoutMilliseconds / founderStartupPollMilliseconds,
);
const founderShutdownTimeoutMilliseconds = 30_000;
const founderShutdownAttempts = Math.ceil(
  founderShutdownTimeoutMilliseconds / founderStartupPollMilliseconds,
);

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function defaultRunProgram(program, arguments_, options = {}) {
  try {
    const result = await execute(program, arguments_, {
      cwd: options.cwd,
      env: options.environment,
      timeout: options.timeout ?? 30_000,
      windowsHide: true,
      maxBuffer: 8_000_000,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
    };
  }
}

async function defaultRepositoryStatus(name, root, runProgram = defaultRunProgram) {
  const result = await runProgram("git", ["-C", root, "status", "--porcelain=v1", "--branch"], {
    timeout: 20_000,
  });
  if (result.code !== 0) throw new Error(`${root} is not an available Git worktree.`);
  const lines = result.stdout.trimEnd().split(/\r?\n/u);
  const revision = await runProgram("git", ["-C", root, "rev-parse", "HEAD"], { timeout: 20_000 });
  if (revision.code !== 0) throw new Error(`Unable to read the revision for ${root}.`);
  return {
    name,
    root,
    branch: lines[0]?.replace(/^## /u, "").split("...")[0] ?? "",
    revision: revision.stdout.trim(),
    clean: lines.slice(1).length === 0,
    changedPaths: lines.slice(1).map((line) => line.slice(3)),
  };
}

async function defaultProbe(url) {
  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await globalThis.fetch(url, { signal: controller.signal });
    return { url, ready: response.ok, status: response.status };
  } catch (error) {
    return { url, ready: false, status: null, error: error.name };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function redact(value, maximum = 64_000) {
  const redacted = String(value)
    .replace(/github_pat_[A-Za-z0-9_]+/gu, "[REDACTED_GITHUB_TOKEN]")
    .replace(/gh[opusr]_[A-Za-z0-9]{20,}/gu, "[REDACTED_GITHUB_TOKEN]");
  return redacted.length <= maximum ? redacted : `${redacted.slice(0, maximum)}\n[TRUNCATED]`;
}

async function founderRuntimeSnapshot(probe) {
  return Object.fromEntries(
    await Promise.all(
      ["gateway", "voice", "search", "ollama"].map(async (name) => [
        name,
        await probe(serviceUrls[name]),
      ]),
    ),
  );
}

function runtimeStatePath(environment) {
  const localAppData = environment?.LOCALAPPDATA;
  return typeof localAppData === "string" && localAppData.length > 0
    ? join(localAppData, "STOIC-IRIS", "runtime", "founder-runtime.json")
    : null;
}

async function readRuntimeState(environment) {
  const path = runtimeStatePath(environment);
  if (path === null) return null;
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    return value?.owner === "iris-founder-runtime" ? value : null;
  } catch {
    return null;
  }
}

async function writeRuntimeState(environment, value) {
  const path = runtimeStatePath(environment);
  if (path === null) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}

async function clearRuntimeState(environment) {
  const path = runtimeStatePath(environment);
  if (path !== null) await rm(path, { force: true });
}

function allReady(snapshot) {
  return Object.values(snapshot).every((service) => service.ready === true);
}

function managedRuntimeReady(snapshot) {
  return snapshot.gateway.ready === true || snapshot.voice.ready === true;
}

async function waitForManagedRuntimeStop(probe, wait) {
  for (let attempt = 0; attempt < founderShutdownAttempts; attempt += 1) {
    const snapshot = await founderRuntimeSnapshot(probe);
    if (!managedRuntimeReady(snapshot)) return snapshot;
    await wait(founderStartupPollMilliseconds);
  }
  throw new Error("The managed Founder runtime did not stop within the bounded shutdown window.");
}

function runtimePhase(snapshot, state, repairing = false) {
  if (repairing) return "repairing";
  if (allReady(snapshot)) return "healthy";
  if (!managedRuntimeReady(snapshot) && state === null) return "stopped";
  if (!managedRuntimeReady(snapshot)) return "starting";
  return "degraded";
}

export async function resolveWorkflowRoots(options = {}) {
  const environment = options.environment ?? process.env;
  const core = resolve(options.coreRoot ?? environment.IRIS_ROOT ?? repositoryRoot);
  const projectsRoot = dirname(core);
  const coreName = basename(core);
  const suffix = coreName.startsWith("STOIC-IRIS") ? coreName.slice("STOIC-IRIS".length) : "";
  const candidates = [
    environment.IRIS_COMMAND_CENTER_ROOT,
    suffix ? join(projectsRoot, `iris-founder-command-center${suffix}`) : null,
    join(projectsRoot, "iris-founder-command-center-main"),
    join(projectsRoot, "iris-founder-command-center"),
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates.map((value) => resolve(value)))]) {
    if (await pathExists(join(candidate, "scripts", "local-gateway.mjs"))) {
      return { core, commandCenter: candidate, projectsRoot };
    }
  }
  throw new Error("The canonical Founder Command Center workspace was not found.");
}

async function workflowStatus(options, overrides) {
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const repositoryStatus =
    overrides.repositoryStatus ??
    ((name, root) =>
      defaultRepositoryStatus(name, root, overrides.runProgram ?? defaultRunProgram));
  const probe = overrides.probe ?? defaultProbe;
  const repositories = await Promise.all([
    repositoryStatus("core", roots.core),
    repositoryStatus("command-center", roots.commandCenter),
  ]);
  const services = Object.fromEntries(
    await Promise.all(
      Object.entries(serviceUrls).map(async ([name, url]) => [name, await probe(url)]),
    ),
  );
  return { ok: true, roots, repositories, services };
}

function quoteWindowsArgument(value) {
  return `"${String(value)
    .replaceAll(/(\\*)"/gu, '$1$1\\"')
    .replaceAll(/(\\+)$/gu, "$1$1")}"`;
}

async function defaultSpawnDetached(program, arguments_, options) {
  const environment = {
    ...options.environment,
    IRIS_DETACHED_PROGRAM: program,
    IRIS_DETACHED_ARGUMENT_LINE: arguments_.map(quoteWindowsArgument).join(" "),
    IRIS_DETACHED_CWD: options.cwd,
    IRIS_DETACHED_STDOUT: options.stdoutPath,
    IRIS_DETACHED_STDERR: options.stderrPath,
  };
  const command = [
    "$program=$env:IRIS_DETACHED_PROGRAM",
    "$argumentLine=$env:IRIS_DETACHED_ARGUMENT_LINE",
    "$workingDirectory=$env:IRIS_DETACHED_CWD",
    "$stdoutPath=$env:IRIS_DETACHED_STDOUT",
    "$stderrPath=$env:IRIS_DETACHED_STDERR",
    "Remove-Item Env:IRIS_DETACHED_PROGRAM,Env:IRIS_DETACHED_ARGUMENT_LINE,Env:IRIS_DETACHED_CWD,Env:IRIS_DETACHED_STDOUT,Env:IRIS_DETACHED_STDERR -ErrorAction SilentlyContinue",
    "$process=Start-Process -FilePath $program -ArgumentList $argumentLine -WorkingDirectory $workingDirectory -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru",
    "[Console]::Out.Write($process.Id)",
  ].join("; ");
  const result = await defaultRunProgram("powershell.exe", ["-NoProfile", "-Command", command], {
    environment,
    timeout: 30_000,
  });
  const pid = Number.parseInt(result.stdout.trim(), 10);
  if (result.code !== 0 || !Number.isInteger(pid) || pid <= 0) {
    throw new Error(`Unable to detach the Founder launcher: ${redact(result.stderr)}`);
  }
  return { pid };
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => globalThis.setTimeout(resolvePromise, milliseconds));
}

async function defaultBootId(runProgram, environment) {
  if (typeof environment.LOCALAPPDATA !== "string" || environment.LOCALAPPDATA.length === 0)
    return "boot_test-session-0001";
  const result = await runProgram(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')",
    ],
    { timeout: 20_000, environment },
  );
  if (result.code !== 0 || result.stdout.trim().length === 0)
    throw new Error("Unable to bind Founder runtime to the current Windows boot.");
  return `boot_${createHash("sha256").update(result.stdout.trim()).digest("hex").slice(0, 24)}`;
}

async function defaultOpenFounderApplication(runProgram, environment) {
  if (typeof environment.LOCALAPPDATA !== "string" || environment.LOCALAPPDATA.length === 0) return;
  const result = await runProgram(
    "powershell.exe",
    ["-NoProfile", "-Command", "Start-Process 'http://127.0.0.1:4174/'"],
    { timeout: 20_000, environment },
  );
  if (result.code !== 0)
    throw new Error("Founder application could not be opened after health verification.");
}

async function startWorkflow(options, overrides) {
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const probe = overrides.probe ?? defaultProbe;
  const before = await founderRuntimeSnapshot(probe);
  if (allReady(before)) {
    return { ok: true, started: false, ready: true, roots, services: before };
  }
  if (managedRuntimeReady(before)) {
    throw new Error(
      "The Founder runtime is partial: one or more required local services are active while the full stack is unavailable. Stop the stale session before restarting.",
    );
  }
  const platform = overrides.platform ?? process.platform;
  if (platform !== "win32") {
    throw new Error(
      "Full-stack startup must be invoked from Windows so the canonical PowerShell launcher can supervise every local service.",
    );
  }
  const launcher = join(roots.core, "scripts", "runtime", "start-founder-command-center.ps1");
  if (!(await pathExists(launcher)))
    throw new Error(`Canonical Founder launcher is missing: ${launcher}.`);
  const spawnDetached = overrides.spawnDetached ?? defaultSpawnDetached;
  const environment = overrides.environment ?? process.env;
  const statePath = runtimeStatePath(environment);
  const logDirectory =
    statePath === null ? join(roots.core, ".iris", "runtime") : dirname(statePath);
  const stdoutPath = join(logDirectory, "founder-launcher.stdout.log");
  const stderrPath = join(logDirectory, "founder-launcher.stderr.log");
  await mkdir(logDirectory, { recursive: true });
  const child = await spawnDetached(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher],
    { cwd: roots.core, environment, stdoutPath, stderrPath },
  );
  if (!Number.isInteger(child.pid) || child.pid <= 0)
    throw new Error("The Founder launcher did not return a process identifier.");
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const bootId =
    (await overrides.resolveBootId?.()) ??
    environment.IRIS_WINDOWS_BOOT_ID ??
    (await defaultBootId(runProgram, environment));
  const commandDigest = `sha256:${createHash("sha256")
    .update(
      JSON.stringify([
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        launcher,
      ]),
    )
    .digest("hex")}`;
  const writeState =
    overrides.writeRuntimeState ?? ((value) => writeRuntimeState(environment, value));
  await writeState({
    owner: "iris-founder-runtime",
    bootId,
    phase: "starting",
    launcherPath: launcher,
    launcherLogs: { stdoutPath, stderrPath },
    processes: [
      { owner: "iris-founder-runtime", service: "launcher", processId: child.pid, commandDigest },
    ],
    lastGreetingBootId: null,
    updatedAt: new Date().toISOString(),
  });
  const wait = overrides.sleep ?? sleep;
  let services;
  for (let attempt = 0; attempt < founderStartupAttempts; attempt += 1) {
    await wait(founderStartupPollMilliseconds);
    services = await founderRuntimeSnapshot(probe);
    if (allReady(services)) {
      await writeState({
        owner: "iris-founder-runtime",
        bootId,
        phase: "healthy",
        launcherPath: launcher,
        launcherLogs: { stdoutPath, stderrPath },
        processes: [
          {
            owner: "iris-founder-runtime",
            service: "launcher",
            processId: child.pid,
            commandDigest,
          },
        ],
        lastGreetingBootId: null,
        greetingReady: true,
        updatedAt: new Date().toISOString(),
      });
      await (
        overrides.openFounderApplication ??
        (() => defaultOpenFounderApplication(runProgram, environment))
      )();
      return {
        ok: true,
        started: true,
        ready: true,
        processId: child.pid,
        bootId,
        roots,
        services,
      };
    }
  }
  const stopStarted =
    overrides.stopStartedProcess ??
    ((processId) =>
      runProgram("taskkill.exe", ["/PID", String(processId), "/T"], { timeout: 30_000 }));
  await stopStarted(child.pid);
  await (overrides.clearRuntimeState ?? (() => clearRuntimeState(environment)))();
  throw new Error(
    `The complete Founder runtime did not become ready after startup (process ${child.pid}). Inspect ${stderrPath} and ${stdoutPath}.`,
  );
}

async function runtimeStatusWorkflow(options, overrides) {
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const probe = overrides.probe ?? defaultProbe;
  const services = await founderRuntimeSnapshot(probe);
  const environment = overrides.environment ?? process.env;
  const state = await (overrides.readRuntimeState ?? (() => readRuntimeState(environment)))();
  return {
    ok: true,
    phase: runtimePhase(services, state),
    roots,
    services,
    ownedProcesses: Array.isArray(state?.processes) ? state.processes : [],
    bootId: state?.bootId ?? null,
    lastGreetingBootId: state?.lastGreetingBootId ?? null,
  };
}

async function defaultStopOwnedProcess(process, state, runProgram) {
  if (
    process?.owner !== "iris-founder-runtime" ||
    !Number.isInteger(process.processId) ||
    process.processId <= 0 ||
    typeof state?.launcherPath !== "string"
  )
    throw new Error("Refusing to stop an unverified runtime process.");
  const escaped = state.launcherPath.replaceAll("'", "''");
  const command = `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${String(process.processId)}"; if($null -eq $p){exit 3}; if($p.CommandLine -notlike '*${escaped}*'){exit 7}`;
  const verified = await runProgram("powershell.exe", ["-NoProfile", "-Command", command], {
    timeout: 20_000,
  });
  if (verified.code === 3) return false;
  if (verified.code === 7) throw new Error("Runtime process ownership no longer matches.");
  if (verified.code !== 0) return false;
  const stopped = await runProgram("taskkill.exe", ["/PID", String(process.processId), "/T"], {
    timeout: 30_000,
  });
  return stopped.code === 0 || /not found|not running/iu.test(String(stopped.stderr));
}

async function stopWorkflow(options, overrides) {
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const environment = overrides.environment ?? process.env;
  const readState = overrides.readRuntimeState ?? (() => readRuntimeState(environment));
  const clearState = overrides.clearRuntimeState ?? (() => clearRuntimeState(environment));
  const state = await readState();
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const stopOwned =
    overrides.stopOwnedProcess ??
    ((process) => defaultStopOwnedProcess(process, state, runProgram));
  const stopped = [];
  for (const process of [...(state?.processes ?? [])].reverse()) {
    if (await stopOwned(process)) stopped.push(process.processId);
  }
  const stopSearch = join(roots.core, "scripts", "runtime", "stop-iris-search.ps1");
  if (await pathExists(stopSearch))
    await runProgram(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", stopSearch],
      {
        cwd: roots.core,
        environment,
        timeout: 60_000,
      },
    );
  await clearState();
  return { ok: true, stopped: stopped.length > 0, stoppedProcessIds: stopped, roots };
}

async function restartWorkflow(options, overrides) {
  await stopWorkflow(options, overrides);
  await waitForManagedRuntimeStop(overrides.probe ?? defaultProbe, overrides.sleep ?? sleep);
  return startWorkflow(options, overrides);
}

async function repairWorkflow(options, overrides) {
  const status = await runtimeStatusWorkflow(options, overrides);
  if (status.phase === "healthy") return { ...status, repaired: false };
  if (status.phase !== "stopped") await stopWorkflow(options, overrides);
  const started = await startWorkflow(options, overrides);
  return { ...started, repaired: true };
}

async function startupRegistrationWorkflow(options, overrides, install) {
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const script = join(
    roots.core,
    "scripts",
    "runtime",
    install ? "install-founder-startup.ps1" : "remove-founder-startup.ps1",
  );
  if (!(await pathExists(script))) throw new Error(`Founder startup script is missing: ${script}.`);
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const arguments_ = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-IrisRepository",
    roots.core,
  ];
  if (options["what-if"] === true) arguments_.push("-WhatIf");
  const result = await runProgram("powershell.exe", arguments_, {
    cwd: roots.core,
    environment: overrides.environment ?? process.env,
    timeout: 60_000,
  });
  if (result.code !== 0)
    throw new Error(`Founder startup ${install ? "installation" : "removal"} failed.`);
  return { ok: true, installed: install, script, whatIf: options["what-if"] === true };
}

function safeRelativePath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    isAbsolute(value)
  ) {
    throw new Error(`Expected a safe relative path, received ${JSON.stringify(value)}.`);
  }
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "");
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Expected a safe relative path, received ${JSON.stringify(value)}.`);
  }
  return normalized;
}

function isInside(child, parent) {
  const value = relative(resolve(parent), resolve(child));
  return value !== "" && value !== ".." && !value.startsWith(`..${sep}`) && !isAbsolute(value);
}

async function corepackInvocation(arguments_, overrides) {
  const platform = overrides.platform ?? process.platform;
  if (platform !== "win32") return { program: "corepack", arguments_ };
  const environment = overrides.environment ?? process.env;
  const candidates = [
    overrides.corepackEntrypoint,
    resolve(dirname(process.execPath), "node_modules", "corepack", "dist", "corepack.js"),
    environment.ProgramFiles
      ? resolve(
          environment.ProgramFiles,
          "nodejs",
          "node_modules",
          "corepack",
          "dist",
          "corepack.js",
        )
      : null,
  ].filter(Boolean);
  for (const entrypoint of [...new Set(candidates)]) {
    if (overrides.corepackEntrypoint === entrypoint || (await pathExists(entrypoint))) {
      return { program: process.execPath, arguments_: [entrypoint, ...arguments_] };
    }
  }
  throw new Error("Corepack JavaScript entrypoint is unavailable.");
}

async function windowsToWslPath(path, runProgram, environment) {
  const result = await runProgram(
    "wsl.exe",
    ["-d", "Ubuntu", "--", "wslpath", "-a", path.replaceAll("\\", "/")],
    { environment, timeout: 20_000 },
  );
  if (result.code !== 0 || result.stdout.trim().length === 0) {
    throw new Error(
      `Unable to resolve the Ubuntu WSL path for ${path}: ${String(
        result.stderr || result.stdout,
      ).trim()}`,
    );
  }
  return result.stdout.trim();
}

async function verifyWorkflow(options, overrides) {
  if (!new Set(["core", "command-center"]).has(options.repo)) {
    throw new Error("--repo must be core or command-center.");
  }
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const root = options.repo === "core" ? roots.core : roots.commandCenter;
  const profile = options.profile ?? "full";
  let pnpmArguments;
  if (profile === "full") {
    pnpmArguments = ["verify"];
  } else if (profile === "focused") {
    const test = safeRelativePath(options.test);
    const absolute = resolve(root, test);
    if (!isInside(absolute, root) || !(await pathExists(absolute))) {
      throw new Error(`Focused test does not exist inside the selected repository: ${test}.`);
    }
    pnpmArguments = ["vitest", "run", test];
  } else {
    throw new Error("--profile must be focused or full.");
  }
  const environment = {
    ...(overrides.environment ?? process.env),
    COREPACK_ENABLE_NETWORK: "0",
    npm_config_offline: "true",
    pnpm_config_offline: "true",
    pnpm_config_verify_deps_before_run: "false",
    PNPM_NETWORK_CONCURRENCY: "0",
  };
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const platform = overrides.platform ?? process.platform;
  let invocation;
  let executionEnvironment = environment;
  if (platform === "win32") {
    const wslRoot = await windowsToWslPath(root, runProgram, environment);
    const wslVariables = ["IRIS_WORKFLOW_ROOT_WSL"];
    executionEnvironment = { ...environment, IRIS_WORKFLOW_ROOT_WSL: wslRoot };
    let command = "exec corepack pnpm verify";
    if (profile === "focused") {
      executionEnvironment.IRIS_WORKFLOW_TEST = pnpmArguments.at(-1);
      wslVariables.push("IRIS_WORKFLOW_TEST");
      command = 'exec corepack pnpm vitest run "$IRIS_WORKFLOW_TEST"';
    }
    const inheritedWslVariables = String(environment.WSLENV ?? "")
      .split(":")
      .filter(Boolean);
    executionEnvironment.WSLENV = [...new Set([...inheritedWslVariables, ...wslVariables])].join(
      ":",
    );
    const shell =
      'source "$HOME/.nvm/nvm.sh"; export COREPACK_ENABLE_NETWORK=0 npm_config_offline=true pnpm_config_offline=true pnpm_config_verify_deps_before_run=false PNPM_NETWORK_CONCURRENCY=0; cd "$IRIS_WORKFLOW_ROOT_WSL"; ' +
      command;
    invocation = {
      program: "wsl.exe",
      arguments_: ["-d", "Ubuntu", "--exec", "bash", "-lc", shell],
    };
  } else {
    invocation = await corepackInvocation(["pnpm", ...pnpmArguments], overrides);
  }
  const startedAt = new Date().toISOString();
  const result = await runProgram(invocation.program, invocation.arguments_, {
    cwd: root,
    environment: executionEnvironment,
    timeout: 1_800_000,
  });
  const observed = `${result.stdout}\n${result.stderr}`;
  return {
    ok: result.code === 0,
    repository: options.repo,
    root,
    profile,
    command: [invocation.program, ...invocation.arguments_],
    exitCode: result.code,
    startedAt,
    finishedAt: new Date().toISOString(),
    outputDigest: `sha256:${createHash("sha256").update(observed).digest("hex")}`,
    outputBytes: Buffer.byteLength(observed),
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
  };
}

async function doctorWorkflow(options, overrides) {
  const status = await workflowStatus(options, overrides);
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const boundedTool = async (program, arguments_) => {
    const result = await runProgram(program, arguments_, { timeout: 20_000 });
    const version =
      String(result.stdout || result.stderr)
        .trim()
        .split(/\r?\n/u)[0]
        ?.slice(0, 240) ?? "";
    return { available: result.code === 0, version };
  };
  const corepack = await corepackInvocation(["--version"], overrides);
  const [git, corepackTool, githubResult] = await Promise.all([
    boundedTool("git", ["--version"]),
    boundedTool(corepack.program, corepack.arguments_),
    runProgram("gh", ["auth", "status"], { timeout: 20_000 }),
  ]);
  return {
    ...status,
    tools: {
      node: { available: true, version: process.version },
      git,
      corepack: corepackTool,
      github: { available: githubResult.code === 0, authenticated: githubResult.code === 0 },
    },
  };
}

function parseWorktreePaths(output) {
  return output
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => resolve(line.slice("worktree ".length)));
}

async function gitResult(root, arguments_, runProgram) {
  return runProgram("git", ["-C", root, ...arguments_], { timeout: 120_000 });
}

function must(result, label) {
  if (result.code !== 0) {
    throw new Error(`${label} failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

async function candidateInspect(options, overrides) {
  if (!options.path) throw new Error("--path is required.");
  const path = resolve(options.path);
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const status = await defaultRepositoryStatus("candidate", path, runProgram);
  const commonDirectory = must(
    await gitResult(path, ["rev-parse", "--git-common-dir"], runProgram),
    "Read candidate Git common directory",
  );
  const registeredPaths = parseWorktreePaths(
    must(await gitResult(path, ["worktree", "list", "--porcelain"], runProgram), "List worktrees"),
  );
  return {
    ok: true,
    ...status,
    path,
    commonDirectory,
    registered: registeredPaths.includes(path),
  };
}

async function candidateClean(options, overrides) {
  if (!new Set(["core", "command-center"]).has(options.repo)) {
    throw new Error("--repo must be core or command-center.");
  }
  if (!options.path || !options["confirm-exact-path"]) {
    throw new Error("--path and --confirm-exact-path are required.");
  }
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const canonical = options.repo === "core" ? roots.core : roots.commandCenter;
  const path = resolve(options.path);
  if (resolve(options["confirm-exact-path"]) !== path) {
    throw new Error("Exact-path confirmation does not match the cleanup target.");
  }
  if (!isInside(path, roots.projectsRoot)) {
    throw new Error(`Candidate path must be below ${roots.projectsRoot}.`);
  }
  if (path === resolve(roots.core) || path === resolve(roots.commandCenter)) {
    throw new Error("Refusing to remove a canonical checkout.");
  }
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const before = parseWorktreePaths(
    must(
      await gitResult(canonical, ["worktree", "list", "--porcelain"], runProgram),
      "List worktrees",
    ),
  );
  if (!before.includes(path)) throw new Error("Target is not an exact registered worktree.");
  const status = await defaultRepositoryStatus(options.repo, path, runProgram);
  if (!status.clean) throw new Error("Candidate worktree is dirty; refusing cleanup.");
  must(
    await gitResult(canonical, ["worktree", "remove", path], runProgram),
    "Remove candidate worktree",
  );
  must(await gitResult(canonical, ["worktree", "prune"], runProgram), "Prune worktree records");
  const after = parseWorktreePaths(
    must(
      await gitResult(canonical, ["worktree", "list", "--porcelain"], runProgram),
      "List worktrees",
    ),
  );
  return {
    ok: true,
    repository: options.repo,
    path,
    registrationAbsent: !after.includes(path),
    filesystemAbsent: !(await pathExists(path)),
    branchPreserved: status.branch,
  };
}

async function proposeUpgrade(options, overrides) {
  if (!options.output) throw new Error("--output is required.");
  const roots = await resolveWorkflowRoots({
    coreRoot: options["core-root"],
    environment: overrides.environment,
  });
  const output = resolve(options.output);
  if (output === roots.core || isInside(output, roots.core)) {
    throw new Error("The unapproved proposal output must be outside IRIS Core.");
  }
  if (output === roots.commandCenter || isInside(output, roots.commandCenter)) {
    throw new Error("The unapproved proposal output must be outside the Founder Command Center.");
  }
  const proposer = join(roots.core, "scripts", "development", "iris-propose-upgrade.mjs");
  if (!(await pathExists(proposer)))
    throw new Error(`IRIS upgrade proposer is missing: ${proposer}.`);
  const runProgram = overrides.runProgram ?? defaultRunProgram;
  const result = await runProgram(process.execPath, [proposer, output], {
    cwd: roots.core,
    environment: overrides.environment ?? process.env,
    timeout: 1_800_000,
  });
  const observed = `${result.stdout}\n${result.stderr}`;
  return {
    ok: result.code === 0,
    output,
    exitCode: result.code,
    outputDigest: `sha256:${createHash("sha256").update(observed).digest("hex")}`,
    outputBytes: Buffer.byteLength(observed),
  };
}

async function workflowReport(options, overrides) {
  const report = {
    ...(await doctorWorkflow(options, overrides)),
    generatedAt: new Date().toISOString(),
  };
  if (!options.output) return report;
  const output = resolve(options.output);
  if (output === report.roots.core || isInside(output, report.roots.core)) {
    throw new Error("Workflow reports must be written outside IRIS Core.");
  }
  if (output === report.roots.commandCenter || isInside(output, report.roots.commandCenter)) {
    throw new Error("Workflow reports must be written outside the Founder Command Center.");
  }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  return { ...report, output };
}

export function helpText() {
  return `IRIS shared local workflow helper

Usage:
  iris-workflow doctor [--json]
  iris-workflow status [--json]
  iris-workflow start [--json]
  iris-workflow runtime status|start|stop|restart|repair [--json]
  iris-workflow runtime install-startup|remove-startup [--what-if] [--json]
  iris-workflow verify --repo core|command-center [--profile focused|full] [--test PATH] [--json]
  iris-workflow candidate inspect --path PATH [--json]
  iris-workflow candidate clean --repo core|command-center --path PATH --confirm-exact-path PATH [--json]
  iris-workflow upgrade propose --output PATH [--json]
  iris-workflow report [--output PATH] [--json]

This helper does not provide stage, commit, publication, provider mutation,
or protected approval-consumption commands.`;
}

export function parseArguments(tokens) {
  const positional = [];
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (key === "json" || key === "help" || key === "what-if") {
      options[key] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}.`);
    }
    options[key] = value;
    index += 1;
  }
  return { positional, options };
}

export function resultExitCode(value) {
  return value && typeof value === "object" && value.ok === false ? 2 : 0;
}

export async function runWorkflow(argv, overrides = {}) {
  const parsed = parseArguments(argv);
  if (parsed.options.help || parsed.positional.length === 0 || parsed.positional[0] === "help") {
    return helpText();
  }
  if (parsed.positional[0] === "status") return workflowStatus(parsed.options, overrides);
  if (parsed.positional[0] === "doctor") return doctorWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "start") return startWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "status")
    return runtimeStatusWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "start")
    return startWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "stop")
    return stopWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "restart")
    return restartWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "repair")
    return repairWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "install-startup")
    return startupRegistrationWorkflow(parsed.options, overrides, true);
  if (parsed.positional[0] === "runtime" && parsed.positional[1] === "remove-startup")
    return startupRegistrationWorkflow(parsed.options, overrides, false);
  if (parsed.positional[0] === "verify") return verifyWorkflow(parsed.options, overrides);
  if (parsed.positional[0] === "candidate" && parsed.positional[1] === "inspect") {
    return candidateInspect(parsed.options, overrides);
  }
  if (parsed.positional[0] === "candidate" && parsed.positional[1] === "clean") {
    return candidateClean(parsed.options, overrides);
  }
  if (parsed.positional[0] === "upgrade" && parsed.positional[1] === "propose") {
    return proposeUpgrade(parsed.options, overrides);
  }
  if (parsed.positional[0] === "report") return workflowReport(parsed.options, overrides);
  throw new Error(`Unknown command.\n\n${helpText()}`);
}
