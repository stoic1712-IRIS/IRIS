import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { loadCompiledOperatingContract } from "../packages/contracts/src/operating-contract.js";

const execute = promisify(execFile);
const cli = resolve("scripts/dev/iris-dev.mjs");
const root = resolve(".");
const compiled = loadCompiledOperatingContract("generated/iris-operating-contract.compiled.json");

async function inspect(extra: string[] = [], cwd = root) {
  const result = await execute(
    process.execPath,
    [cli, "contract", "inspect", "--root", cwd, "--json", ...extra],
    { cwd },
  );
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe("iris-dev canonical contract inspection", () => {
  it("returns the exact validated contract identity and canonical Core revision", async () => {
    const result = await inspect();
    const { coreRevision, ...stable } = result;
    expect(stable).toEqual({
      ok: true,
      contract: "iris.stoic/operating-contract/v1",
      version: "1.0.0",
      digest: compiled.contractDigest,
      authorityOrder: compiled.authorityOrder,
      capability: null,
    });
    expect(typeof coreRevision).toBe("string");
    expect(coreRevision as string).toMatch(/^[a-f0-9]{40}$/u);
    expect(result).not.toHaveProperty("authority");
    expect(result).not.toHaveProperty("approval");
  });

  it("returns one exact ordinary or protected capability", async () => {
    const [ordinary] = compiled.ordinaryCapabilities;
    const [protectedEffect] = compiled.protectedEffects;
    if (ordinary === undefined || protectedEffect === undefined)
      throw new Error("Expected contract capabilities.");
    await expect(inspect(["--capability", ordinary])).resolves.toMatchObject({
      capability: ordinary,
    });
    await expect(inspect(["--capability", protectedEffect])).resolves.toMatchObject({
      capability: protectedEffect,
    });
  });

  it("fails nonzero for an unknown capability or missing or invalid artifact", async () => {
    await expect(inspect(["--capability", "unknown.capability"])).rejects.toMatchObject({
      code: 1,
    });

    const missing = await mkdtemp(join(tmpdir(), "iris-contract-missing-"));
    await expect(inspect([], missing)).rejects.toMatchObject({ code: 1 });

    const invalid = await mkdtemp(join(tmpdir(), "iris-contract-invalid-"));
    await mkdir(join(invalid, "generated"));
    await writeFile(
      join(invalid, "generated", "iris-operating-contract.compiled.json"),
      JSON.stringify({ ...compiled, contractDigest: `sha256:${"0".repeat(64)}` }),
      "utf8",
    );
    await expect(inspect([], invalid)).rejects.toMatchObject({ code: 1 });
  });
});
