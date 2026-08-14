import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { beforeAll, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const gate = resolve("scripts/dev/defect-class-gate.mjs");

interface GateResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execute("git", args, { cwd });
}

// A throwaway repository per case. The gate reads commit messages and changed paths, so the
// fixtures have to be real commits rather than stubbed metadata.
async function repository(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "defect-class-gate-"));
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.name", "Gate Fixture"]);
  await git(cwd, ["config", "user.email", "gate@example.invalid"]);
  await git(cwd, ["config", "commit.gpgsign", "false"]);
  await writeFile(join(cwd, "base.txt"), "base\n");
  await git(cwd, ["add", "base.txt"]);
  await git(cwd, ["commit", "-m", "chore: base"]);
  return cwd;
}

async function commit(cwd: string, message: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await writeFile(join(cwd, path), content);
    await git(cwd, ["add", path]);
  }
  const messagePath = join(cwd, ".commit-message");
  await writeFile(messagePath, message);
  await git(cwd, ["commit", "-F", messagePath]);
}

async function runGate(cwd: string, base = "HEAD~1"): Promise<GateResult> {
  try {
    const result = await execute(process.execPath, [gate, "--base", base], {
      cwd,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: failure.code ?? -1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
    };
  }
}

const complete = [
  "fix: stop the worker repairing without the failing command output",
  "",
  "Defect-class: the delivery worker is not given context it needs to succeed",
  "Class-scan: fixed | adapter.mjs the verification output was discarded",
  "Class-scan: clear | base.txt no worker context is assembled here",
].join("\n");

describe("defect-class repair gate", () => {
  let cwd: string;

  beforeAll(async () => {
    cwd = await repository();
  });

  it("accepts a repair commit that names its class and scans beyond its own changes", async () => {
    const workspace = await repository();
    await commit(workspace, complete, { "adapter.mjs": "repaired\n" });
    const result = await runGate(workspace);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("1 repair commit(s)");
  });

  it("rejects a repair commit with no defect class", async () => {
    const workspace = await repository();
    await commit(
      workspace,
      ["fix: repair the thing", "", "Class-scan: clear | base.txt"].join("\n"),
      { "adapter.mjs": "repaired\n" },
    );
    const result = await runGate(workspace);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no Defect-class line");
  });

  it("rejects a repair commit that records no scan at all", async () => {
    const workspace = await repository();
    await commit(
      workspace,
      ["fix: repair the thing", "", "Defect-class: a real class"].join("\n"),
      { "adapter.mjs": "repaired\n" },
    );
    const result = await runGate(workspace);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no Class-scan line");
  });

  // The rule that carries the weight: three separate pull requests each repaired one instance of
  // one class because nothing ever required looking past the file already open.
  it("rejects a scan that only names files the commit already changed", async () => {
    const workspace = await repository();
    await commit(
      workspace,
      [
        "fix: repair the thing",
        "",
        "Defect-class: a real class",
        "Class-scan: fixed | adapter.mjs",
      ].join("\n"),
      { "adapter.mjs": "repaired\n" },
    );
    const result = await runGate(workspace);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("is not a scan");
  });

  it("rejects a follow-up that names a record which does not exist", async () => {
    const workspace = await repository();
    await commit(
      workspace,
      [
        "fix: repair the thing",
        "",
        "Defect-class: a real class",
        "Class-scan: fixed | adapter.mjs",
        "Class-scan: follow-up | .iris/coordination/tasks/imaginary.json",
      ].join("\n"),
      { "adapter.mjs": "repaired\n" },
    );
    const result = await runGate(workspace);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("follow-up path does not exist");
  });

  it("rejects an unknown verdict", async () => {
    const workspace = await repository();
    await commit(
      workspace,
      [
        "fix: repair the thing",
        "",
        "Defect-class: a real class",
        "Class-scan: probably | base.txt",
      ].join("\n"),
      { "adapter.mjs": "repaired\n" },
    );
    const result = await runGate(workspace);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("unknown Class-scan verdict");
  });

  it("rejects more than one defect class in a single commit", async () => {
    const workspace = await repository();
    await commit(
      workspace,
      [
        "fix: repair two unrelated things at once",
        "",
        "Defect-class: the first class",
        "Defect-class: the second class",
        "Class-scan: clear | base.txt",
      ].join("\n"),
      { "adapter.mjs": "repaired\n" },
    );
    const result = await runGate(workspace);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("a commit repairs exactly one class");
  });

  it("ignores commits that are not repairs", async () => {
    const workspace = await repository();
    await commit(workspace, "feat: add a capability", {
      "feature.mjs": "new\n",
    });
    const result = await runGate(workspace);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("0 repair commit(s)");
  });

  it("ignores reverts", async () => {
    const workspace = await repository();
    await commit(workspace, 'revert: "fix: something earlier"', {
      "adapter.mjs": "reverted\n",
    });
    const result = await runGate(workspace);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("0 repair commit(s)");
  });

  it("reports every violating commit in one run rather than stopping at the first", async () => {
    const workspace = await repository();
    await commit(workspace, "fix: first unrecorded repair", {
      "one.mjs": "a\n",
    });
    await commit(workspace, "fix: second unrecorded repair", {
      "two.mjs": "b\n",
    });
    const result = await runGate(workspace, "HEAD~2");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("failed for 2 of 2 repair commit(s)");
  });

  it("fails loudly rather than passing silently when the base cannot be resolved", async () => {
    const result = await runGate(cwd, "not-a-real-revision");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("could not be resolved");
  });

  it("emits machine-readable violations under --json", async () => {
    const workspace = await repository();
    await commit(workspace, "fix: unrecorded repair", { "adapter.mjs": "a\n" });
    const result = await execute(process.execPath, [gate, "--base", "HEAD~1", "--json"], {
      cwd: workspace,
    }).catch((error: unknown) => ({
      stdout: (error as { stdout?: string }).stdout ?? "",
    }));
    const report = JSON.parse(result.stdout) as {
      repairCommits: number;
      failing: { subject: string; violations: string[] }[];
    };
    expect(report.repairCommits).toBe(1);
    expect(report.failing).toHaveLength(1);
    expect(report.failing[0]?.subject).toBe("fix: unrecorded repair");
  });
});
