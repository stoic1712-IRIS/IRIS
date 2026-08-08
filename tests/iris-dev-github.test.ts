import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
import { main } from ${JSON.stringify(pathToFileURL(cli).href)};
const scenario = JSON.parse(await readFile(process.env.IRIS_DEV_GITHUB_SCENARIO, "utf8"));
const invoke = async (tool, args) => {
const joined = args.join(" ");
const emit = (value) => ({ code: 0, stdout: typeof value === "string" ? value : JSON.stringify(value), stderr: "" });
const fail = (message, code = 1) => ({ code, stdout: "", stderr: message });
if (tool === "git") {
  const state = scenario.git ?? {};
  if (joined.includes("branch --show-current")) return emit(state.branch ?? "main");
  if (joined.includes("rev-parse HEAD")) return emit(state.revision ?? "1111111111111111111111111111111111111111");
  if (joined.includes("status --porcelain")) return emit(state.porcelain ?? "");
  if (joined.includes("remote get-url origin")) return emit(state.originUrl ?? "https://github.com/stoic1712-IRIS/IRIS.git");
  if (joined.includes("rev-parse main")) return emit(state.localMain ?? state.revision ?? "1111111111111111111111111111111111111111");
  if (joined.includes("rev-parse origin/main")) return emit(state.originMain ?? state.localMain ?? state.revision ?? "1111111111111111111111111111111111111111");
  if (joined.includes("ls-remote origin refs/heads/")) return emit((state.remoteMain ?? state.localMain ?? state.revision ?? "1111111111111111111111111111111111111111") + "\\trefs/heads/main\\n");
  if (joined.includes("merge-base --is-ancestor")) return state.ancestor === false ? fail("not ancestor") : emit("");
  return fail("Unexpected git command: " + joined, 91);
} else if (tool === "gh") {
  const state = scenario.gh ?? {};
  if (joined.startsWith("auth status")) {
    if (state.authenticated === false) return fail("not logged in", 1);
    return emit("Logged in to github.com account founder");
  } else if (joined.startsWith("repo view")) return emit(state.repo ?? {});
  else if (joined.startsWith("ruleset check")) {
    if (state.rulesetError) return fail(String(state.rulesetError), 1);
    return emit(state.rulesets ?? "no rulesets apply");
  } else if (joined.startsWith("pr view")) {
    if (state.malformedPr) return emit("{bad json");
    return emit(state.pr ?? {});
  } else if (joined.startsWith("pr checks")) {
    if (state.checksError) return fail(String(state.checksError), 1);
    const result = emit(state.checks ?? []);
    return state.checksExitCode ? { ...result, code: Number(state.checksExitCode) } : result;
  } else if (joined.startsWith("run list")) return emit(state.runs ?? []);
  else if (joined.startsWith("run view")) {
    const id = args[2];
    return emit(state.logs?.[id] ?? "");
  } else return fail("Unexpected gh command: " + joined, 92);
} else return fail("Unexpected tool: " + tool, 93);
};
try {
  await main(process.argv.slice(2), invoke);
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
  process.exitCode = 1;
}`,
    "utf8",
  );
  return { root, repository, scenarioPath, fixturePath };
}

async function runCli(args: string[], scenario: Scenario, extraEnv: Record<string, string> = {}) {
  const h = await harness(scenario);
  try {
    const result = await execute(
      process.execPath,
      [h.fixturePath, ...args, "--root", h.repository, "--json"],
      {
        env: {
          ...process.env,
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

  test("rejects foreign pull-request URLs and malformed command arguments", async () => {
    const foreign = await runCli(
      [
        "github",
        "pr",
        "inspect",
        "--repo",
        "core",
        "--pr",
        "https://github.com/another/repository/pull/84",
      ],
      healthy,
    );
    expect(foreign.code).toBe(1);
    expect(String(foreign.output.error)).toContain("does not belong");

    const duplicate = await runCli(
      ["github", "preflight", "--repo", "core", "--repo", "core"],
      healthy,
    );
    expect(duplicate.code).toBe(1);
    expect(String(duplicate.output.error)).toContain("Duplicate option");

    const extra = await runCli(["github", "preflight", "surprise", "--repo", "core"], healthy);
    expect(extra.code).toBe(1);
    expect(String(extra.output.error)).toContain("Unexpected positional");
  });

  test("preflight fails closed for wrong local origin, detached head, and ruleset failure", async () => {
    const wrongOrigin = structuredClone(healthy);
    gitState(wrongOrigin).originUrl = "https://github.com/another/repository.git";
    expect((await runCli(["github", "preflight", "--repo", "core"], wrongOrigin)).code).toBe(2);

    const detached = structuredClone(healthy);
    gitState(detached).branch = "";
    expect((await runCli(["github", "preflight", "--repo", "core"], detached)).code).toBe(2);

    const rulesetFailure = structuredClone(healthy);
    ghState(rulesetFailure).rulesetError = "provider denied ruleset inspection";
    const result = await runCli(["github", "preflight", "--repo", "core"], rulesetFailure);
    expect(result.code).toBe(2);
    expect(result.output).toMatchObject({ ok: false, rulesetCommandOk: false });
  });

  test("PR inspection fails closed for unsafe review and unsupported check states", async () => {
    const changesRequested = structuredClone(healthy);
    const pr = ghState(changesRequested).pr as Record<string, unknown>;
    pr.reviewDecision = "CHANGES_REQUESTED";
    expect(
      (await runCli(["github", "pr", "inspect", "--repo", "core", "--pr", "84"], changesRequested))
        .code,
    ).toBe(2);

    const skipped = structuredClone(healthy);
    ghState(skipped).checks = [{ name: "verify", state: "SKIPPED", bucket: "skipping" }];
    const skippedResult = await runCli(
      ["github", "pr", "inspect", "--repo", "core", "--pr", "84"],
      skipped,
    );
    expect(skippedResult.code).toBe(2);
    expect(skippedResult.output).toMatchObject({ ok: false, skippedChecks: ["verify"] });

    const absent = structuredClone(healthy);
    ghState(absent).checks = [];
    expect(
      (await runCli(["github", "pr", "inspect", "--repo", "core", "--pr", "84"], absent)).code,
    ).toBe(2);
  });

  test("CI diagnosis fails closed for skipped and neutral runs", async () => {
    for (const conclusion of ["skipped", "neutral"]) {
      const scenario = structuredClone(healthy);
      ghState(scenario).runs = [
        {
          databaseId: 104,
          workflowName: "CI",
          conclusion,
          status: "completed",
          url: "https://github.com/run/104",
          headSha: merge,
          event: "pull_request",
          createdAt: "2026-08-08T00:00:00Z",
          updatedAt: "2026-08-08T00:01:00Z",
        },
      ];
      const result = await runCli(
        ["github", "ci", "diagnose", "--repo", "core", "--pr", "84"],
        scenario,
      );
      expect(result.code).toBe(2);
      expect(result.output.failures).toHaveLength(1);
    }
  });

  test("redacts credential-bearing URI schemes without hiding declared log truncation", async () => {
    const secretOrigin = structuredClone(healthy);
    gitState(secretOrigin).originUrl =
      "ssh://founder:supersecret@github.com/stoic1712-IRIS/IRIS.git";
    const origin = await runCli(["github", "preflight", "--repo", "core"], secretOrigin);
    expect(JSON.stringify(origin.output)).not.toContain("supersecret");

    const largeLog = structuredClone(healthy);
    ghState(largeLog).runs = [
      {
        databaseId: 105,
        workflowName: "CI",
        conclusion: "failure",
        status: "completed",
        url: "https://github.com/run/105",
        headSha: merge,
        event: "pull_request",
        createdAt: "2026-08-08T00:00:00Z",
        updatedAt: "2026-08-08T00:01:00Z",
      },
    ];
    ghState(largeLog).logs = { "105": "x".repeat(100_000) };
    const log = await runCli(
      ["github", "ci", "diagnose", "--repo", "core", "--pr", "84"],
      largeLog,
      { IRIS_DEV_LOG_LIMIT: "1000000" },
    );
    const failure = (log.output.failures as Record<string, unknown>[])[0];
    expect(failure?.truncated).toBe(false);
    expect(String(failure?.log)).toHaveLength(100_000);
  }, 15_000);

  test("rejects options that are not valid for the selected command", async () => {
    const result = await runCli(["github", "preflight", "--repo", "core", "--pr", "84"], healthy);
    expect(result.code).toBe(1);
    expect(String(result.output.error)).toContain("not valid for this command");
  });
});
