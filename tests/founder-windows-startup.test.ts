import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runWorkflow } from "../scripts/workflow/iris-workflow-lib.mjs";

const installScript = resolve("scripts/runtime/install-founder-startup.ps1");
const removeScript = resolve("scripts/runtime/remove-founder-startup.ps1");

describe("Founder Windows startup registration", () => {
  it("uses a non-elevated current-user logon task with one canonical launcher", () => {
    const source = readFileSync(installScript, "utf8");
    expect(source).toContain("New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME");
    expect(source).toContain("-RunLevel Limited");
    expect(source).toContain("-MultipleInstances IgnoreNew");
    expect(source).toContain("start-founder-command-center.ps1");
    expect(source).toContain("[switch]$WhatIf");
    expect(source).not.toMatch(/password|token|secret/iu);
  });

  it("removes only the exact task and supports WhatIf", () => {
    const source = readFileSync(removeScript, "utf8");
    expect(source).toContain('$taskName = "STOIC-IRIS Founder Runtime"');
    expect(source).toContain("Unregister-ScheduledTask -TaskName $taskName -Confirm:$false");
    expect(source).toContain("[switch]$WhatIf");
  });

  it("routes install and removal through exact scripts without embedding credentials", async () => {
    const root = resolve(".");
    const calls: { program: string; args: string[] }[] = [];
    const common = {
      environment: { IRIS_COMMAND_CENTER_ROOT: resolve("..", "iris-founder-command-center-autonomous-operations") },
      runProgram: (program: string, args: string[]) => {
        calls.push({ program, args });
        return { code: 0, stdout: "{}", stderr: "" };
      },
    };
    await runWorkflow(["runtime", "install-startup", "--core-root", root, "--what-if"], common);
    await runWorkflow(["runtime", "remove-startup", "--core-root", root, "--what-if"], common);
    expect(calls.map((call) => call.args.find((value) => value.endsWith(".ps1")))).toEqual([
      installScript,
      removeScript,
    ]);
    expect(JSON.stringify(calls)).not.toMatch(/github_pat_|password|token/iu);
  });
});
