import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  buildRepositoryMap,
  explainRepository,
} from "../../packages/memory/dist/repository-intelligence.js";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);
const packageFiles = files.filter((file) => /^packages\/[^/]+\/package\.json$/.test(file));
const packages = packageFiles.map((packageFile) => {
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  return {
    name: manifest.name,
    path: packageFile.replace(/\/package\.json$/, ""),
    dependencies: Object.keys(manifest.dependencies ?? {}),
  };
});
const protectedPaths = [
  "docs/governance/constitution.md",
  "docs/governance/founder-authority-model.md",
  "docs/governance/worker-reasoning-framework.md",
];
const map = buildRepositoryMap({ files, packages, protectedPaths });
const explanation = explainRepository(map);

process.stdout.write(
  `${JSON.stringify(
    {
      status: "ready",
      summary: explanation.summary,
      packages: map.packages.map(({ name, path }) => ({ name, path })),
      dependencyEdges: map.dependencyEdges,
      testFiles: map.testFiles,
      buildFiles: map.buildFiles,
      protectedPaths: map.protectedPaths,
      citationSample: explanation.citations.slice(0, 10),
    },
    null,
    2,
  )}\n`,
);
