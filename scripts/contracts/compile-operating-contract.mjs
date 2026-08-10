import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = resolve(root, "config/iris-operating-contract.v1.json");
const outputPath = resolve(root, "generated/iris-operating-contract.compiled.json");
const contractModulePath = resolve(root, "packages/contracts/dist/operating-contract.js");
const typescriptPath = resolve(root, "node_modules/typescript/bin/tsc");
const checkOnly = process.argv.includes("--check");

const build = spawnSync(process.execPath, [typescriptPath, "-b", "packages/contracts"], {
  cwd: root,
  encoding: "utf8",
  stdio: "pipe",
});
if (build.status !== 0) {
  process.stderr.write(build.stdout ?? "");
  process.stderr.write(build.stderr ?? "");
  process.exit(build.status ?? 1);
}

const {
  canonicalizeCompiledOperatingContract,
  compileOperatingContract,
  verifyOperatingContractSources,
} = await import(`${pathToFileURL(contractModulePath).href}?contract-compiler`);

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
verifyOperatingContractSources(source, root);
const compiled = compileOperatingContract(source);
const expected = canonicalizeCompiledOperatingContract(compiled);

if (checkOnly) {
  if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== expected) {
    process.stderr.write(
      "Compiled operating contract is missing or stale. Run the compiler without --check.\n",
    );
    process.exit(1);
  }
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, expected, "utf8");
}

process.stdout.write(`${compiled.contractDigest}\n`);
