#!/usr/bin/env node

import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";

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

const githubTokenPattern = /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[opsu]_[A-Za-z0-9]{20,})\b/gu;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu;
const secretAssignmentPattern = /\b(token|password|secret|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu;
const credentialUrlPattern = /(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu;

function help() {
  return `IRIS canonical read-only GitHub evidence helper

Usage:
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

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function bounded(value, limit) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= limit) return { text: value, bytes: bytes.length, truncated: false };
  return { text: bytes.subarray(0, limit).toString("utf8"), bytes: bytes.length, truncated: true };
}

async function run(tool, args, options = {}) {
  const fixture = process.env.IRIS_DEV_TOOL_FIXTURE;
  const program = fixture ? process.execPath : tool;
  const invocation = fixture ? [fixture, tool, ...args] : args;
  try {
    const result = await execute(program, invocation, {
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

function requirePullRequest(options) {
  if (
    !options.pr ||
    !/^(?:[1-9][0-9]*|https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[1-9][0-9]*)$/u.test(options.pr)
  ) {
    throw new Error("--pr must be a pull-request number or GitHub pull-request URL.");
  }
  return options.pr;
}

async function git(root, args) {
  return run("git", ["-C", root, ...args]);
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
    revision: mustText(revisionResult, "Read revision"),
    clean: mustText(statusResult, "Read worktree status") === "",
    originUrl: redact(mustText(originUrlResult, "Read origin URL")),
    localMain,
    originMain,
    providerMain: remoteLine,
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
  const defaultBranch = provider.defaultBranchRef?.name ?? null;
  const ok =
    authenticated &&
    identityMatches &&
    defaultBranch === "main" &&
    snapshot.clean &&
    snapshot.equal;
  return {
    ok,
    proof: "github-preflight",
    repository: repository.name,
    nameWithOwner: provider.nameWithOwner ?? null,
    expectedNameWithOwner: repository.nameWithOwner,
    identityMatches,
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
  const pr = requirePullRequest(options);
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
    try {
      const parsedChecks = JSON.parse(checksResult.stdout);
      if (!Array.isArray(parsedChecks))
        throw new Error("GitHub required-check response was not an array.");
      checks = parsedChecks;
    } catch (error) {
      if (checksResult.code === 0)
        throw new Error("GitHub required-check response was not valid JSON.", { cause: error });
      checksError = redact(checksResult.stderr || checksResult.stdout).trim();
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
  const changedPaths = (details.files ?? [])
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  const ok =
    details.state === "OPEN" &&
    !details.isDraft &&
    details.mergeable === "MERGEABLE" &&
    checksError === null &&
    failedChecks.length === 0 &&
    pendingChecks.length === 0;
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
  };
}

const failureConclusions = new Set([
  "action_required",
  "cancelled",
  "failure",
  "startup_failure",
  "stale",
  "timed_out",
]);

async function ciDiagnosis(options) {
  const repository = requireRepository(options);
  const pr = requirePullRequest(options);
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
  const runs = parseJson(
    await gh([
      "run",
      "list",
      "--repo",
      repository.nameWithOwner,
      "--branch",
      view.headRefName,
      "--limit",
      "50",
      "--json",
      "databaseId,workflowName,conclusion,status,url,headSha,event,createdAt,updatedAt",
    ]),
    "GitHub workflow-run response",
  );
  const exactRuns = runs.filter((runEntry) => runEntry.headSha === view.headRefOid);
  const failedRuns = exactRuns.filter((runEntry) =>
    failureConclusions.has(String(runEntry.conclusion).toLowerCase()),
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
    failures,
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
  const pr = requirePullRequest(options);
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
  process.stdout.write(
    `${typeof value === "string" && !json ? value : JSON.stringify(value, null, 2)}\n`,
  );
}

async function main() {
  const { positional, options } = parse(process.argv.slice(2));
  if (options.help || positional.length === 0 || positional[0] === "help") {
    print(help(), options.json);
    return;
  }
  const [command, first, second] = positional;
  let result;
  if (command !== "github") throw new Error(`Unknown command.\n\n${help()}`);
  if (first === "preflight") result = await preflight(options);
  else if (first === "pr" && second === "inspect") result = await pullRequest(options);
  else if (first === "ci" && second === "diagnose") result = await ciDiagnosis(options);
  else if (first === "handoff") result = await handoff(options);
  else if (first === "merged" && second === "verify") result = await mergedVerify(options);
  else throw new Error(`Unknown GitHub evidence command.\n\n${help()}`);
  print(result, options.json);
  if (result.ok === false) process.exitCode = 2;
}

main().catch((error) => {
  print({ ok: false, error: redact(error.message) }, true);
  process.exitCode = 1;
});
