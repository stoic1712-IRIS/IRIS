import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const requiredPackages = ["contracts", "kernel", "coordination", "model-gateway"] as const;

interface PackageManifest {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function readManifest(relativePath: string): Promise<PackageManifest> {
  const contents = await readFile(path.join(repositoryRoot, relativePath), "utf8");
  return JSON.parse(contents) as PackageManifest;
}

describe("Wave 1 repository baseline", () => {
  it("defines the required private IRIS package boundaries", async () => {
    for (const packageDirectory of requiredPackages) {
      const manifest = await readManifest(`packages/${packageDirectory}/package.json`);
      expect(manifest.name).toBe(`@stoic-iris/${packageDirectory}`);
      expect(manifest.private).toBe(true);
    }
  });

  it("uses workspace protocol for every internal dependency", async () => {
    for (const packageDirectory of requiredPackages) {
      const manifest = await readManifest(`packages/${packageDirectory}/package.json`);
      for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
        if (name.startsWith("@stoic-iris/")) {
          expect(version).toBe("workspace:*");
        }
      }
    }
  });

  it("pins the approved root toolchain exactly", async () => {
    const manifest = await readManifest("package.json");
    expect(manifest.devDependencies).toEqual({
      "@eslint/js": "10.0.1",
      "@types/node": "24.13.3",
      eslint: "10.8.0",
      prettier: "3.9.6",
      typescript: "6.0.3",
      "typescript-eslint": "8.66.0",
      vitest: "4.1.10",
    });
  });

  it("exposes every required root verification command", async () => {
    const manifest = await readManifest("package.json");
    for (const command of [
      "build",
      "typecheck",
      "test",
      "lint",
      "format:check",
      "diagnostics",
      "verify",
    ]) {
      expect(manifest.scripts).toHaveProperty(command);
    }
  });

  it("keeps later-wave package sources as empty governed boundaries", async () => {
    for (const packageDirectory of ["kernel", "coordination", "model-gateway"] as const) {
      const sourceDirectory = path.join(repositoryRoot, "packages", packageDirectory, "src");
      expect(await readdir(sourceDirectory)).toEqual(["index.ts"]);
      const source = await readFile(path.join(sourceDirectory, "index.ts"), "utf8");
      expect(source).toContain("Later-wave behavior requires its own approved specification.");
      expect(source.trim().endsWith("export {};"), packageDirectory).toBe(true);
    }
  });
});
