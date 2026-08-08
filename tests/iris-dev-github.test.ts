import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, test } from "vitest";

const execute = promisify(execFile);
const cli = resolve("scripts/dev/iris-dev.mjs");

test("full verification builds referenced workspace declarations before linting", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  const verify = manifest.scripts?.verify;
  expect(verify).toBeTruthy();
  expect(verify?.indexOf("pnpm build")).toBeLessThan(verify?.indexOf("pnpm lint") ?? -1);
});

interface Scenario {
  git?: Record<string, unknown>;
  gh?: Record<string, unknown>;
}

function ghState(scenario: Scenario) {
  scenario.gh ??= {};
  return scenario.gh;
}

function gitState(scenario: Scenario) {
  scenario.git ??= {};
  return scenario.git;
}

async function harness(scenario: Scenario) {
  const root = await mkdtemp(join(tmpdir(), "iris-dev-github-"));
  const repository = join(root, "repo");
  await mkdir(repository);
  const scenarioPath = join(root, "scenario.json");
  const fixturePath = join(root, "fixture.mjs");
  await writeFile(scenarioPath, JSON.stringify(scenario), "utf8");
  await writeFile(
    fixturePath,
    `import { readFile } from "node:fs/promises";
const scenario = JSON.parse(await readFile(process.env.IRIS_DEV_GITHUB_SCENARIO, "utf8"));
const [tool, ...args] = process.argv.slice(2);
const joined = args.join(" ");
const emit = (value) => process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
const fail = (message, code = 1) => { process.stderr.write(message); process.exit(code); };
if (tool === "git") {
  const state = scenario.git ?? {};
  if (joined.includes("branch --show-current")) emit(state.branch ?? "main");
  else if (joined.includes("rev-parse HEAD")) emit(state.revision ?? "1111111111111111111111111111111111111111");
  else if (joined.includes("status --porcelain")) emit(state.porcelain ?? "");
  else if (joined.includes("remote get-url origin")) emit(state.originUrl ?? "https://github.com/stoic1712-IRIS/IRIS.git");
  else if (joined.includes("rev-parse main")) emit(state.localMain ?? state.revision ?? "1111111111111111111111111111111111111111");
  else if (joined.includes("rev-parse origin/main")) emit(state.originMain ?? state.localMain ?? state.revision ?? "1111111111111111111111111111111111111111");
  else if (joined.includes("ls-remote origin refs/heads/")) emit((state.remoteMain ?? state.localMain ?? state.revision ?? "1111111111111111111111111111111111111111") + "\\trefs/heads/main\\n");
  else if (joined.includes("merge-base --is-ancestor")) process.exit(state.ancestor === false ? 1 : 0);
  else fail("Unexpected git command: " + joined, 91);
} else if (tool === "gh") {
  const state = scenario.gh ?? {};
  if (joined.startsWith("auth status")) {
    if (state.authenticated === false) fail("not logged in", 1);
    emit("Logged in to github.com account founder");
  } else if (joined.startsWith("repo view")) emit(state.repo ?? {});
  else if (joined.startsWith("ruleset check")) {
    if (state.rulesetError) fail(String(state.rulesetError), 1);
    emit(state.rulesets ?? "no rulesets apply");
  } else if (joined.startsWith("pr view")) {
    if (state.malformedPr) emit("{bad json");
    else emit(state.pr ?? {});
  } else if (joined.startsWith("pr checks")) {
    if (state.checksError) fail(String(state.checksError), 1);
    emit(state.checks ?? []);
    if (state.checksExitCode) process.exit(Number(state.checksExitCode));
  } else if (joined.startsWith("run list")) emit(state.runs ?? []);
  else if (joined.startsWith("run view")) {
    const id = args[2];
    emit(state.logs?.[id] ?? "");
  } else fail("Unexpected gh command: " + joined, 92);
} else fail("Unexpected tool: " + tool, 93);`,
    "utf8",
  );
  return { root, repository, scenarioPath, fixturePath };
}

async function runCli(args: string[], scenario: Scenario, extraEnv: Record<string, string> = {}) {
  const h = await harness(scenario);
  try {
    const result = await execute(
      process.execPath,
      [cli, ...args, "--root", h.repository, "--json"],
      {
        env: {
          ...process.env,
          IRIS_DEV_TOOL_FIXTURE: h.fixturePath,
          IRIS_DEV_GITHUB_SCENARIO: h.scenarioPath,
          ...extraEnv,
        },
      },
    );
    return { code: 0, output: JSON.parse(result.stdout) as Record<string, unknown> };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failure.code ?? 1,
      output: JSON.parse(failure.stdout ?? "{}") as Record<string, unknown>,
      stderr: failure.stderr ?? "",
    };
  }
}

const main = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const merge = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const healthy: Scenario = {
  git: {
    branch: "main",
    revision: main,
    localMain: main,
    originMain: main,
    remoteMain: main,
    porcelain: "",
  },
  gh: {
    authenticated: true,
    repo: {
      nameWithOwner: "stoic1712-IRIS/IRIS",
      defaultBranchRef: { name: "main" },
      visibility: "PUBLIC",
      viewerPermission: "ADMIN",
      url: "https://github.com/stoic1712-IRIS/IRIS",
    },
    rulesets: "Branch rules for main: pull request required",
    pr: {
      number: 84,
      url: "https://github.com/stoic1712-IRIS/IRIS/pull/84",
      state: "OPEN",
      isDraft: false,
      baseRefName: "main",
      baseRefOid: main,
      headRefName: "iris/example",
      headRefOid: merge,
      mergeable: "MERGEABLE",
      reviewDecision: "APPROVED",
      mergeCommit: null,
      files: [{ path: "README.md", additions: 2, deletions: 0 }],
      statusCheckRollup: [],
      mergedAt: null,
    },
    checks: [
      {
        name: "verify",
        state: "SUCCESS",
        bucket: "pass",
        link: "https://github.com/run/101",
        workflow: "CI",
        event: "pull_request",
      },
    ],
    runs: [
      {
        databaseId: 101,
        workflowName: "CI",
        conclusion: "success",
        status: "completed",
        url: "https://github.com/run/101",
        headSha: merge,
        event: "pull_request",
        createdAt: "2026-08-08T00:00:00Z",
        updatedAt: "2026-08-08T00:01:00Z",
      },
    ],
    logs: { "101": "" },
  },
};

describe("IRIS GitHub evidence CLI", () => {
  test("help exposes the five read-only GitHub proofs", async () => {
    const result = await execute(process.execPath, [cli, "help"]);
    expect(result.stdout).toContain("github preflight");
    expect(result.stdout).toContain("github pr inspect");
    expect(result.stdout).toContain("github ci diagnose");
    expect(result.stdout).toContain("github handoff");
    expect(result.stdout).toContain("github merged verify");
    expect(result.stdout).toContain("No GitHub mutation command is provided");
  });

  test("preflight binds repository identity, provider head, local refs, and rulesets", async () => {
    const result = await runCli(["github", "preflight", "--repo", "core"], healthy);
    expect(result.code).toBe(0);
    expect(result.output).toMatchObject({
      ok: true,
      repository: "core",
      nameWithOwner: "stoic1712-IRIS/IRIS",
      branch: "main",
      clean: true,
      localMain: main,
      originMain: main,
      providerMain: main,
      equal: true,
    });
    expect(result.output.rulesets).toContain("pull request required");
  });

  test("pull-request inspection preserves failed and pending required checks", async () => {
    const scenario = structuredClone(healthy);
    ghState(scenario).checks = [
      {
        name: "build",
        state: "FAILURE",
        bucket: "fail",
        link: "https://github.com/run/102",
        workflow: "CI",
        event: "pull_request",
      },
      {
        name: "review",
        state: "PENDING",
        bucket: "pending",
        link: "https://github.com/run/103",
        workflow: "Review",
        event: "pull_request",
      },
    ];
    const result = await runCli(
      ["github", "pr", "inspect", "--repo", "core", "--pr", "84"],
      scenario,
    );
    expect(result.code).toBe(2);
    expect(result.output).toMatchObject({
      ok: false,
      failedChecks: ["build"],
      pendingChecks: ["review"],
    });
    expect(result.output.changedPaths).toEqual(["README.md"]);
  });

  test("pull-request inspection keeps structured failed checks from a nonzero gh exit", async () => {
    const scenario = structuredClone(healthy);
    ghState(scenario).checks = [
      {
        name: "build",
        state: "FAILURE",
        bucket: "fail",
        link: "https://github.com/run/102",
        workflow: "CI",
        event: "pull_request",
      },
    ];
    ghState(scenario).checksExitCode = 1;

    const result = await runCli(
      ["github", "pr", "inspect", "--repo", "core", "--pr", "84"],
      scenario,
    );

    expect(result.code).toBe(2);
    expect(result.output).toMatchObject({
      ok: false,
      failedChecks: ["build"],
      checksError: null,
      checksCommandExitCode: 1,
    });
  });

  test("preflight fails closed for missing authentication and wrong repository identity", async () => {
    const unauthenticated = structuredClone(healthy);
    ghState(unauthenticated).authenticated = false;
    const authResult = await runCli(["github", "preflight", "--repo", "core"], unauthenticated);
    expect(authResult.code).toBe(2);
    expect(authResult.output).toMatchObject({ ok: false, authenticated: false });

    const wrongRepository = structuredClone(healthy);
    ghState(wrongRepository).repo = {
      nameWithOwner: "someone-else/IRIS",
      defaultBranchRef: { name: "main" },
      visibility: "PUBLIC",
      viewerPermission: "READ",
      url: "https://github.com/someone-else/IRIS",
    };
    const repoResult = await runCli(["github", "preflight", "--repo", "core"], wrongRepository);
    expect(repoResult.code).toBe(2);
    expect(repoResult.output).toMatchObject({ ok: false, identityMatches: false });
  });

  test("CI diagnosis binds runs to the exact head, redacts secrets, and caps logs", async () => {
    const scenario = structuredClone(healthy);
    ghState(scenario).runs = [
      {
        databaseId: 102,
        workflowName: "CI",
        conclusion: "failure",
        status: "completed",
        url: "https://github.com/run/102",
        headSha: merge,
        event: "pull_request",
        createdAt: "2026-08-08T00:00:00Z",
        updatedAt: "2026-08-08T00:01:00Z",
      },
      {
        databaseId: 999,
        workflowName: "old",
        conclusion: "failure",
        status: "completed",
        url: "https://github.com/run/999",
        headSha: main,
        event: "push",
        createdAt: "2026-08-07T00:00:00Z",
        updatedAt: "2026-08-07T00:01:00Z",
      },
    ];
    ghState(scenario).logs = { "102": `github_pat_${"a".repeat(90)} ${"x".repeat(300)}` };
    const result = await runCli(
      ["github", "ci", "diagnose", "--repo", "core", "--pr", "84"],
      scenario,
      { IRIS_DEV_LOG_LIMIT: "128" },
    );
    expect(result.code).toBe(2);
    const failures = result.output.failures as Record<string, unknown>[];
    expect(failures).toHaveLength(1);
    const failure = failures[0];
    expect(failure).toBeTruthy();
    expect(failure?.log).not.toContain("github_pat_");
    expect(failure).toMatchObject({ databaseId: 102, truncated: true });
    expect(failure?.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  test("handoff preserves preflight, PR, and CI sub-results", async () => {
    const result = await runCli(["github", "handoff", "--repo", "core", "--pr", "84"], healthy);
    expect(result.code).toBe(0);
    expect(result.output).toMatchObject({ ok: true, repository: "core" });
    expect(result.output.preflight).toBeTruthy();
    expect(result.output.pullRequest).toBeTruthy();
    expect(result.output.ci).toBeTruthy();
  });

  test("merged verification requires exact provider, local-main, and origin-main equality", async () => {
    const scenario = structuredClone(healthy);
    Object.assign(gitState(scenario), {
      revision: merge,
      localMain: merge,
      originMain: merge,
      remoteMain: merge,
    });
    const currentPullRequest = ghState(scenario).pr;
    if (!currentPullRequest || typeof currentPullRequest !== "object")
      throw new Error("Fixture pull request is missing.");
    ghState(scenario).pr = {
      ...currentPullRequest,
      state: "MERGED",
      mergedAt: "2026-08-08T01:00:00Z",
      mergeCommit: { oid: merge },
    };
    const passing = await runCli(
      ["github", "merged", "verify", "--repo", "core", "--pr", "84"],
      scenario,
    );
    expect(passing.code).toBe(0);
    expect(passing.output).toMatchObject({
      ok: true,
      mergeCommit: merge,
      localMain: merge,
      originMain: merge,
      providerMain: merge,
      equal: true,
    });

    gitState(scenario).originMain = main;
    const failing = await runCli(
      ["github", "merged", "verify", "--repo", "core", "--pr", "84"],
      scenario,
    );
    expect(failing.code).toBe(2);
    expect(failing.output).toMatchObject({ ok: false, equal: false });
  });

  test("malformed GitHub JSON fails closed without a completion claim", async () => {
    const scenario = structuredClone(healthy);
    ghState(scenario).malformedPr = true;
    const result = await runCli(
      ["github", "pr", "inspect", "--repo", "core", "--pr", "84"],
      scenario,
    );
    expect(result.code).toBe(1);
    expect(result.output).toMatchObject({ ok: false });
    expect(String(result.output.error)).toContain(
      "GitHub pull-request response was not valid JSON",
    );
  });
});
