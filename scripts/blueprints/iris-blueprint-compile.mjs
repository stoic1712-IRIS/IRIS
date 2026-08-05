import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  compileDockerCompose,
  createRemovalManifest,
  createRollbackManifest,
  infrastructureBlueprintSchema,
  validateBlueprint,
} from "../../packages/blueprints/dist/index.js";

const [, , input = "examples/blueprints/iris-local-stack.json", output = ".iris/blueprints"] =
  process.argv;
const inputPath = resolve(input);
const outputPath = resolve(output);
const blueprint = infrastructureBlueprintSchema.parse(
  JSON.parse(await readFile(inputPath, "utf8")),
);
const findings = validateBlueprint(blueprint);
const errors = findings.filter((finding) => finding.severity === "error");

if (errors.length > 0) {
  process.stderr.write(`${JSON.stringify({ valid: false, findings }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  await mkdir(outputPath, { recursive: true });
  await Promise.all([
    writeFile(resolve(outputPath, "compose.yaml"), compileDockerCompose(blueprint), "utf8"),
    writeFile(
      resolve(outputPath, "rollback.json"),
      `${JSON.stringify(createRollbackManifest(blueprint), null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(outputPath, "removal.json"),
      `${JSON.stringify(createRemovalManifest(blueprint), null, 2)}\n`,
      "utf8",
    ),
  ]);
  process.stdout.write(
    `${JSON.stringify({ valid: true, blueprint: blueprint.id, profile: blueprint.profile, findings, outputPath }, null, 2)}\n`,
  );
}
