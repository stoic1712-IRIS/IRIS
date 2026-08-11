#!/usr/bin/env node

import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { loadCompiledOperatingContract } from "../../packages/contracts/dist/index.js";
import { z } from "zod";

const execute = promisify(execFile);

const repositories = {
  core: {
    root: process.env.IRIS_CORE_ROOT || "C:/Projects/STOIC-IRIS",
    nameWithOwner: "stoic1712-IRIS/IRIS",
  },
  "command-center": {
    root: process.env.IRIS_COMMAND_CENTER_ROOT || "C:/Projects/iris-founder-command-center-main",
    nameWithOwner: "stoic1712-IRIS/iris-founder-command-center",
  },
};

const githubTokenPattern = /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[oprsu]_[A-Za-z0-9]{20,})\b/gu;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu;
const secretAssignmentPattern = /\b(token|password|secret|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu;
const credentialUrlPattern = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/giu;

function help() {
  return `IRIS canonical read-only GitHub evidence helper

Usage:
  iris-dev contract inspect [--capability NAME] [--root PATH] [--json]
  iris-dev github preflight --repo core|command-center [--root PATH] [--json]
  iris-dev github pr inspect --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
  iris-dev github ci diagnose --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
  iris-dev github handoff --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]
  iris-dev github merged verify --repo core|command-center --pr NUMBER|URL [--root PATH] [--json]

No GitHub mutation command is provided. This helper does not stage, commit,
push, merge, approve, comment, retry, administer, install, deploy, or spend.`;
}

function parse(tokens) {
  const positional = [];
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (!new Set(["repo", "root", "pr", "capability", "json", "help"]).has(key))
      throw new Error(`Unknown option --${key}.`);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option --${key}.`);
    if (new Set(["json", "help"]).has(key)) {
      options[key] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Missing value for --${key}.`);
    options[key] = value;
    index += 1;
  }
  return { positional, options };
}

function redact(value) {
  return String(value ?? "")
    .replace(githubTokenPattern, "[REDACTED_GITHUB_TOKEN]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(secretAssignmentPattern, (_match, key) => `${key}=[REDACTED]`)
    .replace(credentialUrlPattern, "$1[REDACTED]@");
}

function sanitize(value, depth = 0) {
  if (depth > 8) return "[REDACTED_DEPTH_LIMIT]";
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitize(entry, depth + 1)]),
    );
  return value;
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function bounded(value, limit) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= limit) return { text: value, bytes: bytes.length, truncated: false };
  return { text: bytes.subarray(0, limit).toString("utf8"), bytes: bytes.length, truncated: true };
}

async function runTool(tool, args, options = {}) {
  try {
    const result = await execute(tool, args, {
      cwd: options.cwd,
      env: process.env,
      windowsHide: true,
      maxBuffer: 8_000_000,
      timeout: options.timeout ?? 120_000,
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

let run = runTool;

function parseJson(result, label) {
  if (result.code !== 0)
    throw new Error(`${label} failed: ${redact(result.stderr || result.stdout).trim()}`);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} was not valid JSON.`);
  }
}

function requireRepository(options) {
  const name = options.repo;
  if (!Object.hasOwn(repositories, name)) throw new Error("--repo must be core or command-center.");
  return {
    name,
    ...repositories[name],
    root: resolve(options.root || repositories[name].root),
  };
}

function requirePullRequest(options, repository) {
  if (!options.pr) {
    throw new Error("--pr must be a pull-request number or GitHub pull-request URL.");
  }
  if (/^[1-9][0-9]*$/u.test(options.pr)) return options.pr;
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([1-9][0-9]*)\/?$/u.exec(
    options.pr,
  );
  if (!match) throw new Error("--pr must be a pull-request number or GitHub pull-request URL.");
  const slug = `${match[1]}/${match[2]}`.toLowerCase();
  if (slug !== repository.nameWithOwner.toLowerCase())
    throw new Error("The pull-request URL does not belong to the selected repository.");
  return match[3];
}

const oidPattern = /^[0-9a-f]{40}$/u;

function requireOid(value, label) {
  if (typeof value !== "string" || !oidPattern.test(value))
    throw new Error(`${label} was invalid.`);
  return value;
}

function normalizeGithubSlug(url) {
  const match = /(?:github\.com[/:])([^/]+)\/([^/]+?)(?:\.git)?$/iu.exec(String(url).trim());
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}

function validatePullRequest(details, repository, expectedNumber) {
  if (!details || typeof details !== "object")
    throw new Error("GitHub pull-request response was invalid.");
  if (details.number !== Number(expectedNumber))
    throw new Error("GitHub returned a different pull request.");
  const expectedUrl = `https://github.com/${repository.nameWithOwner}/pull/${expectedNumber}`;
  if (details.url !== expectedUrl)
    throw new Error("GitHub returned a pull request from another repository.");
  if (details.baseRefName !== "main") throw new Error("Pull request base must be main.");
  requireOid(details.baseRefOid, "Pull request base revision");
  requireOid(details.headRefOid, "Pull request head revision");
  if (!Array.isArray(details.files)) throw new Error("Pull request files were invalid.");
  for (const file of details.files)
    if (!file || typeof file.path !== "string" || file.path.length === 0)
      throw new Error("Pull request file entry was invalid.");
}

function validateChecks(checks) {
  if (!Array.isArray(checks)) throw new Error("GitHub required-check response was not an array.");
  const allowedBuckets = new Set(["pass", "fail", "cancel", "pending", "skipping"]);
  for (const check of checks) {
    if (!check || typeof check.name !== "string" || typeof check.bucket !== "string")
      throw new Error("GitHub required-check entry was invalid.");
    if (!allowedBuckets.has(check.bucket.toLowerCase()))
      throw new Error(`GitHub required check ${check.name} had an unsupported bucket.`);
  }
}

async function git(root, args) {
  const result = await run("git", ["-C", root, ...args]);
  if (result.code === 0) return result;

  // A Git worktree created by Git for Windows records an absolute Windows
  // gitdir. WSL Git otherwise treats that value as relative to the worktree.
  // Retry only that exact cross-platform case; every other Git error remains
  // unchanged and fail-closed.
  if (!/^\/mnt\/[a-z]\//u.test(root)) return result;
  const failureText = `${result.stderr}\n${result.stdout}`;
  if (!/not a git repository:/iu.test(failureText) || !/[\\/][A-Za-z]:[\\/]/u.test(failureText))
    return result;
  let pointer;
  try {
    pointer = readFileSync(join(root, ".git"), "utf8").trim();
  } catch {
    return result;
  }
  const match = /^gitdir:\s*([A-Za-z]):[\\/](.+)$/u.exec(pointer);
  if (match === null) return result;
  const drive = match[1];
  const remainder = match[2];
  if (drive === undefined || remainder === undefined) return result;
  const gitDirectory = `/mnt/${drive.toLowerCase()}/${remainder.replaceAll("\\", "/")}`;
  return run("git", ["--git-dir", gitDirectory, "--work-tree", root, ...args]);
}

const contractInspectionSchema = z
  .object({
    ok: z.literal(true),
    contract: z.literal("iris.stoic/operating-contract/v1"),
    version: z.literal("1.0.0"),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    authorityOrder: z.tuple([
      z.literal("explicit-founder-instruction"),
      z.literal("canonical-operating-contract"),
      z.literal("contract-bound-canonical-sources"),
      z.literal("verified-live-state"),
      z.literal("supporting-context"),
    ]),
    coreRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    capability: z.string().nullable(),
  })
  .strict();

async function inspectContract(options) {
  const root = resolve(options.root || process.cwd());
  const contract = loadCompiledOperatingContract(
    join(root, "generated", "iris-operating-contract.compiled.json"),
  );
  const knownCapabilities = new Set([
    ...contract.ordinaryCapabilities,
    ...contract.protectedEffects,
  ]);
  const capability = options.capability ?? null;
  if (capability !== null && !knownCapabilities.has(capability))
    throw new Error(`Unknown operating-contract capability: ${capability}.`);
  const coreRevision = requireOid(
    mustText(await git(root, ["rev-parse", "HEAD"]), "Core revision"),
    "Core revision",
  );
  return contractInspectionSchema.parse({
    ok: true,
    contract: contract.contract,
    version: contract.version,
    digest: contract.contractDigest,
    authorityOrder: contract.authorityOrder,
    coreRevision,
    capability,
  });
}

async function gh(args) {
  return run("gh", args);
}

function mustText(result, label) {
  if (result.code !== 0)
    throw new Error(`${label} failed: ${redact(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

async function gitSnapshot(repository) {
  const [
    branchResult,
    revisionResult,
    statusResult,
    originUrlResult,
    localMainResult,
    originMainResult,
    remoteMainResult,
  ] = await Promise.all([
    git(repository.root, ["branch", "--show-current"]),
    git(repository.root, ["rev-parse", "HEAD"]),
    git(repository.root, ["status", "--porcelain=v1"]),
    git(repository.root, ["remote", "get-url", "origin"]),
    git(repository.root, ["rev-parse", "main"]),
    git(repository.root, ["rev-parse", "origin/main"]),
    git(repository.root, ["ls-remote", "origin", "refs/heads/main"]),
  ]);
  const remoteLine = mustText(remoteMainResult, "Read provider main").split(/\s+/u)[0] ?? "";
  const localMain = mustText(localMainResult, "Read local main");
  const originMain = mustText(originMainResult, "Read origin/main");
  return {
    root: repository.root,
    branch: mustText(branchResult, "Read branch"),
    revision: requireOid(mustText(revisionResult, "Read revision"), "Working revision"),
    clean: mustText(statusResult, "Read worktree status") === "",
    originUrl: redact(mustText(originUrlResult, "Read origin URL")),
    originSlug: normalizeGithubSlug(mustText(originUrlResult, "Read origin URL")),
    localMain: requireOid(localMain, "Local main revision"),
    originMain: requireOid(originMain, "Origin main revision"),
    providerMain: requireOid(remoteLine, "Provider main revision"),
    equal: Boolean(remoteLine) && localMain === originMain && originMain === remoteLine,
  };
}

async function preflight(options) {
  const repository = requireRepository(options);
  const auth = await gh(["auth", "status", "--hostname", "github.com"]);
  const authenticated = auth.code === 0;
  const repositoryResult = await gh([
    "repo",
    "view",
    repository.nameWithOwner,
    "--json",
    "nameWithOwner,defaultBranchRef,visibility,viewerPermission,url",
  ]);
  const provider = parseJson(repositoryResult, "GitHub repository response");
  const ruleset = await gh(["ruleset", "check", "--repo", repository.nameWithOwner, "--default"]);
  const snapshot = await gitSnapshot(repository);
  const identityMatches = provider.nameWithOwner === repository.nameWithOwner;
  const localIdentityMatches = snapshot.originSlug === repository.nameWithOwner.toLowerCase();
  const defaultBranch = provider.defaultBranchRef?.name ?? null;
  const ok =
    authenticated &&
    identityMatches &&
    localIdentityMatches &&
    defaultBranch === "main" &&
    ruleset.code === 0 &&
    snapshot.branch === "main" &&
    snapshot.revision === snapshot.localMain &&
    snapshot.clean &&
    snapshot.equal;
  return {
    ok,
    proof: "github-preflight",
    repository: repository.name,
    nameWithOwner: provider.nameWithOwner ?? null,
    expectedNameWithOwner: repository.nameWithOwner,
    identityMatches,
    localIdentityMatches,
    authenticated,
    authenticationEvidence: redact(auth.stdout || auth.stderr).trim(),
    defaultBranch,
    visibility: provider.visibility ?? null,
    viewerPermission: provider.viewerPermission ?? null,
    url: provider.url ?? null,
    rulesets: redact(ruleset.stdout || ruleset.stderr).trim(),
    rulesetCommandOk: ruleset.code === 0,
    ...snapshot,
  };
}

async function pullRequest(options) {
  const repository = requireRepository(options);
  const pr = requirePullRequest(options, repository);
  const view = await gh([
    "pr",
    "view",
    pr,
    "--repo",
    repository.nameWithOwner,
    "--json",
    "number,url,state,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,mergeable,reviewDecision,mergeCommit,files,statusCheckRollup,mergedAt",
  ]);
  let details;
  try {
    details = parseJson(view, "GitHub pull-request response");
  } catch (error) {
    if (String(error.message).includes("not valid JSON")) {
      throw new Error("GitHub pull-request response was not valid JSON.", { cause: error });
    }
    throw error;
  }
  validatePullRequest(details, repository, pr);
  const checksResult = await gh([
    "pr",
    "checks",
    pr,
    "--repo",
    repository.nameWithOwner,
    "--required",
    "--json",
    "name,state,bucket,link,workflow,event",
  ]);
  let checks = [];
  let checksError = null;
  if (checksResult.stdout.trim() !== "") {
    let parsedChecks;
    try {
      parsedChecks = JSON.parse(checksResult.stdout);
    } catch (error) {
      if (checksResult.code === 0)
        throw new Error("GitHub required-check response was not valid JSON.", { cause: error });
      checksError = redact(checksResult.stderr || checksResult.stdout).trim();
    }
    if (parsedChecks !== undefined) {
      validateChecks(parsedChecks);
      checks = parsedChecks;
    }
  } else if (checksResult.code !== 0) {
    checksError = redact(checksResult.stderr).trim();
  }
  const failedChecks = checks
    .filter((check) => ["fail", "cancel"].includes(String(check.bucket).toLowerCase()))
    .map((check) => check.name);
  const pendingChecks = checks
    .filter((check) => String(check.bucket).toLowerCase() === "pending")
    .map((check) => check.name);
  const skippedChecks = checks
    .filter((check) => String(check.bucket).toLowerCase() === "skipping")
    .map((check) => check.name);
  const changedPaths = (details.files ?? [])
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  const ok =
    details.state === "OPEN" &&
    !details.isDraft &&
    details.mergeable === "MERGEABLE" &&
    String(details.reviewDecision).toUpperCase() !== "CHANGES_REQUESTED" &&
    checksError === null &&
    checksResult.code === 0 &&
    checks.length > 0 &&
    failedChecks.length === 0 &&
    pendingChecks.length === 0 &&
    skippedChecks.length === 0;
  return {
    ok,
    proof: "github-pr-inspect",
    repository: repository.name,
    nameWithOwner: repository.nameWithOwner,
    ...details,
    changedPaths,
    requiredChecks: checks,
    checksCommandExitCode: checksResult.code,
    checksError,
    failedChecks,
    pendingChecks,
    skippedChecks,
  };
}

async function ciDiagnosis(options) {
  const repository = requireRepository(options);
  const pr = requirePullRequest(options, repository);
  const view = parseJson(
    await gh([
      "pr",
      "view",
      pr,
      "--repo",
      repository.nameWithOwner,
      "--json",
      "number,url,headRefName,headRefOid",
    ]),
    "GitHub pull-request response",
  );
  if (
    view.number !== Number(pr) ||
    view.url !== `https://github.com/${repository.nameWithOwner}/pull/${pr}`
  )
    throw new Error("GitHub returned a pull request from another repository.");
  requireOid(view.headRefOid, "Pull request head revision");
  const runs = parseJson(
    await gh([
      "run",
      "list",
      "--repo",
      repository.nameWithOwner,
      "--commit",
      view.headRefOid,
      "--limit",
      "50",
      "--json",
      "databaseId,workflowName,conclusion,status,url,headSha,event,createdAt,updatedAt",
    ]),
    "GitHub workflow-run response",
  );
  if (!Array.isArray(runs)) throw new Error("GitHub workflow-run response was not an array.");
  for (const runEntry of runs) {
    if (
      !runEntry ||
      typeof runEntry.databaseId !== "number" ||
      typeof runEntry.status !== "string" ||
      typeof runEntry.conclusion !== "string" ||
      typeof runEntry.headSha !== "string" ||
      !oidPattern.test(runEntry.headSha)
    )
      throw new Error("GitHub workflow-run entry was invalid.");
  }
  const exactRuns = runs.filter((runEntry) => runEntry.headSha === view.headRefOid);
  const failedRuns = exactRuns.filter(
    (runEntry) =>
      String(runEntry.status).toLowerCase() === "completed" &&
      String(runEntry.conclusion).toLowerCase() !== "success",
  );
  const pendingRuns = exactRuns.filter(
    (runEntry) => String(runEntry.status).toLowerCase() !== "completed",
  );
  const limit = Math.min(Math.max(Number(process.env.IRIS_DEV_LOG_LIMIT || 65_536), 64), 1_000_000);
  const failures = [];
  for (const failedRun of failedRuns) {
    const logResult = await gh([
      "run",
      "view",
      String(failedRun.databaseId),
      "--repo",
      repository.nameWithOwner,
      "--log-failed",
    ]);
    const redacted = redact(logResult.stdout || logResult.stderr);
    const limited = bounded(redacted, limit);
    failures.push({
      ...failedRun,
      logCommandOk: logResult.code === 0,
      log: limited.text,
      logBytes: limited.bytes,
      truncated: limited.truncated,
      digest: digest(redacted),
    });
  }
  return {
    ok: failedRuns.length === 0 && pendingRuns.length === 0 && exactRuns.length > 0,
    proof: "github-ci-diagnose",
    repository: repository.name,
    nameWithOwner: repository.nameWithOwner,
    pullRequest: view.number,
    headRefName: view.headRefName,
    headRefOid: view.headRefOid,
    exactRuns,
    failures: sanitize(failures),
    pendingRuns,
  };
}

async function handoff(options) {
  const [preflightResult, pullRequestResult, ciResult] = await Promise.all([
    preflight(options),
    pullRequest(options),
    ciDiagnosis(options),
  ]);
  return {
    ok: preflightResult.ok && pullRequestResult.ok && ciResult.ok,
    proof: "github-handoff",
    repository: requireRepository(options).name,
    generatedAt: new Date().toISOString(),
    preflight: preflightResult,
    pullRequest: pullRequestResult,
    ci: ciResult,
  };
}

async function mergedVerify(options) {
  const repository = requireRepository(options);
  const pr = requirePullRequest(options, repository);
  const details = parseJson(
    await gh([
      "pr",
      "view",
      pr,
      "--repo",
      repository.nameWithOwner,
      "--json",
      "number,url,state,mergedAt,mergeCommit,baseRefName,headRefName,headRefOid",
    ]),
    "GitHub pull-request response",
  );
  if (
    details.number !== Number(pr) ||
    details.url !== `https://github.com/${repository.nameWithOwner}/pull/${pr}`
  )
    throw new Error("GitHub returned a pull request from another repository.");
  if (details.baseRefName !== "main") throw new Error("Pull request base must be main.");
  requireOid(details.headRefOid, "Pull request head revision");
  const snapshot = await gitSnapshot(repository);
  const mergeCommit = details.mergeCommit?.oid ?? null;
  const equality =
    Boolean(mergeCommit) &&
    mergeCommit === snapshot.localMain &&
    snapshot.localMain === snapshot.originMain &&
    snapshot.originMain === snapshot.providerMain;
  return {
    ok: details.state === "MERGED" && Boolean(details.mergedAt) && snapshot.clean && equality,
    proof: "github-merged-verify",
    repository: repository.name,
    nameWithOwner: repository.nameWithOwner,
    pullRequest: details.number,
    url: details.url,
    state: details.state,
    mergedAt: details.mergedAt,
    mergeCommit,
    clean: snapshot.clean,
    localMain: snapshot.localMain,
    originMain: snapshot.originMain,
    providerMain: snapshot.providerMain,
    equal: equality,
  };
}

function print(value, json) {
  const safeValue = sanitize(value);
  process.stdout.write(
    `${typeof safeValue === "string" && !json ? safeValue : JSON.stringify(safeValue, null, 2)}\n`,
  );
}

export async function main(argv = process.argv.slice(2), injectedRun = runTool) {
  run = injectedRun;
  const { positional, options } = parse(argv);
  if (options.help || positional.length === 0 || positional[0] === "help") {
    print(help(), options.json);
    return;
  }
  const [command, first, second] = positional;
  const expectedArity = first === "pr" || first === "ci" || first === "merged" ? 3 : 2;
  if (positional.length !== expectedArity) throw new Error("Unexpected positional argument.");
  let result;
  const requireOptions = (allowed, required) => {
    for (const key of Object.keys(options))
      if (!allowed.has(key)) throw new Error(`Option --${key} is not valid for this command.`);
    for (const key of required)
      if (!Object.hasOwn(options, key)) throw new Error(`Missing required option --${key}.`);
  };
  if (command === "contract" && first === "inspect") {
    requireOptions(new Set(["root", "capability", "json"]), []);
    result = await inspectContract(options);
  } else if (command !== "github") throw new Error(`Unknown command.\n\n${help()}`);
  else if (first === "preflight") {
    requireOptions(new Set(["repo", "root", "json"]), ["repo"]);
    result = await preflight(options);
  } else if (first === "pr" && second === "inspect") {
    requireOptions(new Set(["repo", "root", "pr", "json"]), ["repo", "pr"]);
    result = await pullRequest(options);
  } else if (first === "ci" && second === "diagnose") {
    requireOptions(new Set(["repo", "root", "pr", "json"]), ["repo", "pr"]);
    result = await ciDiagnosis(options);
  } else if (first === "handoff") {
    requireOptions(new Set(["repo", "root", "pr", "json"]), ["repo", "pr"]);
    result = await handoff(options);
  } else if (first === "merged" && second === "verify") {
    requireOptions(new Set(["repo", "root", "pr", "json"]), ["repo", "pr"]);
    result = await mergedVerify(options);
  } else throw new Error(`Unknown GitHub evidence command.\n\n${help()}`);
  print(result, options.json);
  if (result.ok === false) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    print({ ok: false, error: redact(error.message) }, true);
    process.exitCode = 1;
  });
