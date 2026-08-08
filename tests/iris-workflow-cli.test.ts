import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resultExitCode, runWorkflow } from "../scripts/workflow/iris-workflow-lib.mjs";

const cli = resolve("scripts/workflow/iris-workflow.mjs");

function git(root: string, ...arguments_: string[]) {
  const result = spawnSync("git", ["-C", root, ...arguments_], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function initializeRepository(root: string) {
  mkdirSync(root, { recursive: true });
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "IRIS Workflow Test");
  git(root, "config", "user.email", "iris-workflow@example.invalid");
  writeFileSync(join(root, "README.md"), "fixture\n");
  git(root, "add", "README.md");
  git(root, "commit", "-m", "test: initialize fixture");
}

describe("IRIS workflow CLI", () => {
  it("exposes the shared safe workflow commands", () => {
    const result = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("iris-workflow doctor");
    expect(result.stdout).toContain("iris-workflow start");
    expect(result.stdout).toContain("iris-workflow runtime status|start|stop|restart|repair");
    expect(result.stdout).toContain("iris-workflow verify");
    expect(result.stdout).toContain("iris-workflow candidate inspect");
    expect(result.stdout).toContain("iris-workflow upgrade propose");
    expect(result.stdout).not.toMatch(/\b(push|merge|deploy|credential|spending)\b/iu);

    const jsonHelp = spawnSync(process.execPath, [cli, "--help", "--json"], {
      encoding: "utf8",
    });
    expect(jsonHelp.status, jsonHelp.stderr).toBe(0);
    expect(JSON.parse(jsonHelp.stdout) as { ok: boolean }).toMatchObject({ ok: true });
  });

  it("fails closed for unknown commands", async () => {
    await expect(runWorkflow(["unknown"])).rejects.toThrow(/unknown command/iu);
  });

  it("selects the canonical main Command Center instead of a stale legacy checkout", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-roots-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const canonicalRoot = join(projectsRoot, "iris-founder-command-center-main");
    const legacyRoot = join(projectsRoot, "iris-founder-command-center");

    try {
      for (const root of [coreRoot, canonicalRoot, legacyRoot]) {
        mkdirSync(join(root, "scripts"), { recursive: true });
        if (root !== coreRoot) writeFileSync(join(root, "scripts", "local-gateway.mjs"), "");
      }

      const result = await runWorkflow(["status", "--core-root", coreRoot], {
        environment: {},
        probe: (url) => ({ url, ready: false, status: null }),
        repositoryStatus: (name, root) => ({ name, root, clean: true }),
      });

      expect(result).toMatchObject({
        ok: true,
        roots: { core: coreRoot, commandCenter: canonicalRoot },
      });
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("starts only through the complete canonical Founder launcher", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-start-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const launcher = join(coreRoot, "scripts", "runtime", "start-founder-command-center.ps1");
    const launches: { program: string; arguments_: string[]; cwd: string }[] = [];
    let gatewayProbeCount = 0;

    try {
      mkdirSync(join(coreRoot, "scripts", "runtime"), { recursive: true });
      writeFileSync(launcher, "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");

      const result = await runWorkflow(["start", "--core-root", coreRoot], {
        environment: {},
        platform: "win32",
        probe: (url) => {
          const isGateway = url.includes(":4174/");
          if (isGateway) gatewayProbeCount += 1;
          const ready = gatewayProbeCount > 1;
          return { url, ready, status: ready ? 200 : null };
        },
        sleep: () => undefined,
        spawnDetached: (program, arguments_, options) => {
          launches.push({ program, arguments_, cwd: options.cwd });
          return { pid: 4242 };
        },
      });

      expect(result).toMatchObject({ ok: true, started: true, ready: true, processId: 4242 });
      expect(launches).toEqual([
        {
          program: "powershell.exe",
          arguments_: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", launcher],
          cwd: coreRoot,
        },
      ]);
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("waits beyond the former thirty-second boundary for a healthy cold start", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-slow-start-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const launcher = join(coreRoot, "scripts", "runtime", "start-founder-command-center.ps1");
    let gatewayProbeCount = 0;
    let waitCount = 0;

    try {
      mkdirSync(join(coreRoot, "scripts", "runtime"), { recursive: true });
      writeFileSync(launcher, "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");

      const result = await runWorkflow(["start", "--core-root", coreRoot], {
        environment: {},
        platform: "win32",
        probe: (url) => {
          if (url.includes(":4174/")) gatewayProbeCount += 1;
          const ready = gatewayProbeCount > 61;
          return { url, ready, status: ready ? 200 : null };
        },
        sleep: () => {
          waitCount += 1;
        },
        spawnDetached: () => ({ pid: 4242 }),
      });

      expect(result).toMatchObject({ ok: true, started: true, ready: true, processId: 4242 });
      expect(waitCount).toBe(61);
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("refuses to report success for a partially running Founder stack", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-partial-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    let launched = false;

    try {
      mkdirSync(join(coreRoot, "scripts", "runtime"), { recursive: true });
      writeFileSync(join(coreRoot, "scripts", "runtime", "start-founder-command-center.ps1"), "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");

      await expect(
        runWorkflow(["start", "--core-root", coreRoot], {
          environment: {},
          platform: "win32",
          probe: (url) => ({
            url,
            ready: !url.includes(":8765/"),
            status: url.includes(":8765/") ? null : 200,
          }),
          spawnDetached: () => {
            launched = true;
            return { pid: 4242 };
          },
        }),
      ).rejects.toThrow(/partial/iu);
      expect(launched).toBe(false);
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("refuses startup when any required side service is orphaned", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-orphan-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    let launched = false;

    try {
      mkdirSync(join(coreRoot, "scripts", "runtime"), { recursive: true });
      writeFileSync(join(coreRoot, "scripts", "runtime", "start-founder-command-center.ps1"), "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");

      await expect(
        runWorkflow(["start", "--core-root", coreRoot], {
          environment: {},
          platform: "win32",
          probe: (url) => ({
            url,
            ready: url.includes(":8765/"),
            status: url.includes(":8765/") ? 200 : null,
          }),
          sleep: () => undefined,
          spawnDetached: () => {
            launched = true;
            return { pid: 4242 };
          },
        }),
      ).rejects.toThrow(/partial/iu);
      expect(launched).toBe(false);
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("reports lifecycle phase and stops only recorded IRIS-owned processes", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-lifecycle-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const stopped: number[] = [];
    let cleared = false;
    try {
      mkdirSync(join(coreRoot, "scripts", "runtime"), { recursive: true });
      writeFileSync(join(coreRoot, "scripts", "runtime", "stop-iris-search.ps1"), "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");
      const state = {
        owner: "iris-founder-runtime",
        bootId: "boot_test-session-0001",
        processes: [{ owner: "iris-founder-runtime", processId: 4242 }],
      };
      const common = {
        environment: {},
        readRuntimeState: () => state,
        probe: (url) => ({ url, ready: url.includes(":4174/"), status: url.includes(":4174/") ? 200 : null }),
      };
      expect(await runWorkflow(["runtime", "status", "--core-root", coreRoot], common))
        .toMatchObject({ ok: true, phase: "degraded", bootId: state.bootId });
      const result = await runWorkflow(["runtime", "stop", "--core-root", coreRoot], {
        ...common,
        stopOwnedProcess: (process) => { stopped.push(process.processId); return true; },
        clearRuntimeState: () => { cleared = true; },
        runProgram: () => ({ code: 0, stdout: "", stderr: "" }),
      });
      expect(result).toMatchObject({ ok: true, stopped: true, stoppedProcessIds: [4242] });
      expect(stopped).toEqual([4242]);
      expect(cleared).toBe(true);
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("runs verification with package-manager network access disabled", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-verify-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const invocations: {
      program: string;
      arguments_: string[];
      environment: NodeJS.ProcessEnv | undefined;
    }[] = [];

    try {
      mkdirSync(join(coreRoot, "scripts"), { recursive: true });
      mkdirSync(join(coreRoot, "tests"), { recursive: true });
      writeFileSync(join(coreRoot, "package.json"), '{"scripts":{"verify":"pnpm test"}}');
      writeFileSync(join(coreRoot, "tests", "focused.test.ts"), "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");

      const result = await runWorkflow(
        [
          "verify",
          "--repo",
          "core",
          "--core-root",
          coreRoot,
          "--profile",
          "focused",
          "--test",
          "tests/focused.test.ts",
        ],
        {
          environment: { EXISTING: "preserved" },
          platform: "win32",
          runProgram: (program, arguments_, options) => {
            invocations.push({ program, arguments_, environment: options.environment });
            if (arguments_.includes("wslpath")) {
              return { code: 0, stdout: "/mnt/c/fixture/STOIC-IRIS\n", stderr: "" };
            }
            return { code: 0, stdout: "verified github_pat_secretvalue", stderr: "" };
          },
        },
      );

      expect(result).toMatchObject({ ok: true, repository: "core", exitCode: 0 });
      expect(invocations).toHaveLength(2);
      expect(invocations[0]).toMatchObject({
        program: "wsl.exe",
        arguments_: ["-d", "Ubuntu", "--", "wslpath", "-a", coreRoot.replaceAll("\\", "/")],
      });
      expect(invocations[1]?.program).toBe("wsl.exe");
      expect(invocations[1]?.arguments_).toEqual([
        "-d",
        "Ubuntu",
        "--exec",
        "bash",
        "-lc",
        'source "$HOME/.nvm/nvm.sh"; export COREPACK_ENABLE_NETWORK=0 npm_config_offline=true pnpm_config_offline=true pnpm_config_verify_deps_before_run=false PNPM_NETWORK_CONCURRENCY=0; cd "$IRIS_WORKFLOW_ROOT_WSL"; exec corepack pnpm vitest run "$IRIS_WORKFLOW_TEST"',
      ]);
      expect(invocations[1]?.environment).toMatchObject({
        EXISTING: "preserved",
        COREPACK_ENABLE_NETWORK: "0",
        IRIS_WORKFLOW_ROOT_WSL: "/mnt/c/fixture/STOIC-IRIS",
        IRIS_WORKFLOW_TEST: "tests/focused.test.ts",
        npm_config_offline: "true",
        pnpm_config_offline: "true",
      });
      expect(invocations[1]?.environment?.WSLENV).toMatch(
        /IRIS_WORKFLOW_ROOT_WSL:IRIS_WORKFLOW_TEST/u,
      );
      expect(invocations[1]?.arguments_.join(" ")).not.toMatch(/install|add|update/iu);
      expect(JSON.stringify(result)).not.toContain("github_pat_secretvalue");
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("reports bounded tool readiness without returning authentication output", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-doctor-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");

    try {
      mkdirSync(join(coreRoot, "scripts"), { recursive: true });
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");
      const result = await runWorkflow(["doctor", "--core-root", coreRoot], {
        environment: {},
        repositoryStatus: (name, root) => ({ name, root, clean: true }),
        probe: (url) => ({ url, ready: true, status: 200 }),
        runProgram: (program) => ({
          code: 0,
          stdout: program === "gh" ? "secret-bearing-auth-output" : `${program} version`,
          stderr: "",
        }),
      });

      expect(result).toMatchObject({
        ok: true,
        tools: {
          node: { available: true },
          git: { available: true },
          corepack: { available: true },
          github: { available: true, authenticated: true },
        },
      });
      expect(JSON.stringify(result)).not.toContain("secret-bearing-auth-output");
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("inspects and removes only an exact clean registered candidate worktree", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-candidate-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const candidateRoot = join(projectsRoot, "STOIC-IRIS-candidate");

    try {
      initializeRepository(coreRoot);
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");
      git(coreRoot, "worktree", "add", "-b", "iris/test-candidate", candidateRoot, "main");

      await expect(
        runWorkflow(
          [
            "candidate",
            "clean",
            "--repo",
            "core",
            "--path",
            candidateRoot,
            "--confirm-exact-path",
            join(projectsRoot, "different-candidate"),
            "--core-root",
            coreRoot,
          ],
          { environment: {} },
        ),
      ).rejects.toThrow(/confirmation/iu);
      await expect(
        runWorkflow(
          [
            "candidate",
            "clean",
            "--repo",
            "core",
            "--path",
            coreRoot,
            "--confirm-exact-path",
            coreRoot,
            "--core-root",
            coreRoot,
          ],
          { environment: {} },
        ),
      ).rejects.toThrow(/canonical/iu);
      const unregisteredRoot = join(projectsRoot, "STOIC-IRIS-unregistered");
      mkdirSync(unregisteredRoot);
      await expect(
        runWorkflow(
          [
            "candidate",
            "clean",
            "--repo",
            "core",
            "--path",
            unregisteredRoot,
            "--confirm-exact-path",
            unregisteredRoot,
            "--core-root",
            coreRoot,
          ],
          { environment: {} },
        ),
      ).rejects.toThrow(/registered/iu);

      const inspection = await runWorkflow(
        ["candidate", "inspect", "--path", candidateRoot, "--core-root", coreRoot],
        { environment: {} },
      );
      expect(inspection).toMatchObject({
        ok: true,
        path: candidateRoot,
        branch: "iris/test-candidate",
        clean: true,
        registered: true,
      });

      writeFileSync(join(candidateRoot, "README.md"), "dirty\n");
      await expect(
        runWorkflow(
          [
            "candidate",
            "clean",
            "--repo",
            "core",
            "--path",
            candidateRoot,
            "--confirm-exact-path",
            candidateRoot,
            "--core-root",
            coreRoot,
          ],
          { environment: {} },
        ),
      ).rejects.toThrow(/dirty/iu);
      expect(existsSync(candidateRoot)).toBe(true);

      git(candidateRoot, "restore", "README.md");
      const cleanup = await runWorkflow(
        [
          "candidate",
          "clean",
          "--repo",
          "core",
          "--path",
          candidateRoot,
          "--confirm-exact-path",
          candidateRoot,
          "--core-root",
          coreRoot,
        ],
        { environment: {} },
      );
      expect(cleanup).toMatchObject({
        ok: true,
        path: candidateRoot,
        filesystemAbsent: true,
        registrationAbsent: true,
        branchPreserved: "iris/test-candidate",
      });
      expect(existsSync(candidateRoot)).toBe(false);
    } finally {
      if (existsSync(candidateRoot)) git(coreRoot, "worktree", "remove", "--force", candidateRoot);
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("delegates non-executable upgrade proposals only to an output outside Core", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-proposal-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const output = join(projectsRoot, "proposal.json");
    const invocations: { program: string; arguments_: string[]; cwd: string }[] = [];

    try {
      mkdirSync(join(coreRoot, "scripts", "development"), { recursive: true });
      writeFileSync(join(coreRoot, "scripts", "development", "iris-propose-upgrade.mjs"), "");
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");

      const result = await runWorkflow(
        ["upgrade", "propose", "--output", output, "--core-root", coreRoot],
        {
          environment: {},
          runProgram: (program, arguments_, options) => {
            if (!options.cwd) throw new Error("Expected proposer working directory.");
            invocations.push({ program, arguments_, cwd: options.cwd });
            return { code: 0, stdout: '{"proposalPath":"outside"}', stderr: "" };
          },
        },
      );
      expect(result).toMatchObject({ ok: true, output, exitCode: 0 });
      expect(invocations).toEqual([
        {
          program: process.execPath,
          arguments_: [
            join(coreRoot, "scripts", "development", "iris-propose-upgrade.mjs"),
            output,
          ],
          cwd: coreRoot,
        },
      ]);
      await expect(
        runWorkflow(
          [
            "upgrade",
            "propose",
            "--output",
            join(coreRoot, "proposal.json"),
            "--core-root",
            coreRoot,
          ],
          { environment: {} },
        ),
      ).rejects.toThrow(/outside/iu);
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });

  it("registers the shared CLI as the root workflow script", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: { workflow?: string };
    };
    expect(packageJson.scripts.workflow).toBe("node scripts/workflow/iris-workflow.mjs");
  });

  it("returns a non-zero process code for a completed command that reports failure", () => {
    expect(resultExitCode({ ok: false })).toBe(2);
    expect(resultExitCode({ ok: true })).toBe(0);
    expect(resultExitCode("help")).toBe(0);
  });

  it("writes a bounded combined report outside both repositories without overwriting", async () => {
    const projectsRoot = mkdtempSync(join(tmpdir(), "iris-workflow-report-"));
    const coreRoot = join(projectsRoot, "STOIC-IRIS");
    const commandCenterRoot = join(projectsRoot, "iris-founder-command-center-main");
    const output = join(projectsRoot, "workflow-report.json");
    const overrides = {
      environment: {},
      repositoryStatus: (name: string, root: string) => ({ name, root, clean: true }),
      probe: (url: string) => ({ url, ready: true, status: 200 }),
      runProgram: (program: string) => ({
        code: 0,
        stdout: program === "gh" ? "private-auth-output" : `${program} version`,
        stderr: "",
      }),
    };

    try {
      mkdirSync(join(coreRoot, "scripts"), { recursive: true });
      mkdirSync(join(commandCenterRoot, "scripts"), { recursive: true });
      writeFileSync(join(commandCenterRoot, "scripts", "local-gateway.mjs"), "");
      const result = await runWorkflow(
        ["report", "--output", output, "--core-root", coreRoot],
        overrides,
      );

      expect(result).toMatchObject({ ok: true, output });
      const written = JSON.parse(readFileSync(output, "utf8")) as {
        ok: boolean;
        roots: { core: string; commandCenter: string };
      };
      expect(written).toMatchObject({
        ok: true,
        roots: { core: coreRoot, commandCenter: commandCenterRoot },
      });
      expect(JSON.stringify(written)).not.toContain("private-auth-output");
      await expect(
        runWorkflow(["report", "--output", output, "--core-root", coreRoot], overrides),
      ).rejects.toThrow();
    } finally {
      rmSync(projectsRoot, { force: true, recursive: true });
    }
  });
});
