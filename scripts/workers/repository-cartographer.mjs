import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll("\\", "/"));
  }
};
walk(root);

const packages = files.filter((file) => /^packages\/[^/]+\/package\.json$/.test(file));
const tests = files.filter((file) => file.startsWith("tests/") && file.endsWith(".test.ts"));
const sourceFiles = files.filter((file) => /^packages\/[^/]+\/src\/.*\.ts$/.test(file));
const output = {
  fileCount: files.length,
  packageCount: packages.length,
  testCount: tests.length,
  sourceFileCount: sourceFiles.length,
  packages,
  tests,
  citations: [
    ...packages.map((file) => `repository:${file}`),
    ...tests.map((file) => `repository:${file}`),
  ],
};
process.stdout.write(`${JSON.stringify(output)}\n`);
