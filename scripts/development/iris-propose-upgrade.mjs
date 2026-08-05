import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const output = process.argv[2];
if (output === undefined)
  throw new Error("Usage: node iris-propose-upgrade.mjs <proposal-output-outside-repository>");
const repository = process.cwd();
const outputPath = resolve(output);
if (
  outputPath === repository ||
  outputPath.startsWith(`${repository}/`) ||
  outputPath.startsWith(`${repository}\\`)
)
  throw new Error("The unapproved proposal must be written outside the canonical repository.");

const git = (...args) => execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
if (git("status", "--porcelain") !== "")
  throw new Error("Canonical repository must be clean before model inspection.");
const baseRevision = git("rev-parse", "HEAD");
const paths = [
  "packages/development/src/index.ts",
  "packages/development/src/contracts.ts",
  "packages/development/src/sovereign-development-runtime.ts",
  "tests/wave-10-sovereign-development-runtime.test.ts",
  "docs/specifications/wave-10-sovereign-development-runtime.md",
];
const sources = [];
for (const path of paths) {
  try {
    sources.push({ path, content: await readFile(resolve(repository, path), "utf8") });
  } catch {
    sources.push({ path, content: "<absent>" });
  }
}

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    changes: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          operation: { type: "string", enum: ["create", "update"] },
          content: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["path", "operation", "content", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "changes"],
  additionalProperties: false,
};
const prompt = `You are IRIS, not Codex or Claude. Inspect the supplied canonical repository files and propose a genuine small multi-file self-upgrade that adds a deterministic self-description/status capability to the Sovereign Development Runtime. The change must be original, useful, tested, documented, and limited to packages/development/src, tests, and docs/specifications. Return exact complete file contents, not patches. Do not alter governance, GitHub configuration, dependencies, lockfiles, or existing evidence. Prefer creating a self-description module, exporting it, adding tests, and adding documentation. Preserve all existing behavior.\n\n${JSON.stringify({ baseRevision, sources })}`;
const response = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: "qwen3:8b",
    messages: [{ role: "user", content: prompt }],
    stream: false,
    think: false,
    format: schema,
    options: { temperature: 0 },
  }),
});
if (!response.ok) throw new Error(`Ollama request failed: ${response.status}`);
const modelResult = JSON.parse((await response.json()).message.content);
const digest = (text) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const allowedPaths = ["packages/development/src", "tests", "docs/specifications"];
const changes = [];
for (const change of modelResult.changes) {
  const normalized = change.path.replaceAll("\\", "/");
  if (!allowedPaths.some((root) => normalized.startsWith(`${root}/`)))
    throw new Error(`Model proposed disallowed path: ${normalized}`);
  let previous = null;
  try {
    previous = await readFile(resolve(repository, normalized), "utf8");
  } catch {}
  if ((previous === null) !== (change.operation === "create"))
    throw new Error(`Model operation does not match repository: ${normalized}`);
  changes.push({
    path: normalized,
    operation: change.operation,
    beforeDigest: previous === null ? null : digest(previous),
    afterDigest: digest(change.content),
    content: change.content,
    rationale: change.rationale,
  });
}
const proposal = {
  proposalId: "proposal_wave-10-graduation",
  objective: modelResult.summary,
  canonicalRepository: "stoic1712-IRIS/IRIS",
  baseRevision,
  branch: "iris/wave-10-graduation-proof",
  allowedPaths,
  forbiddenPaths: ["docs/governance", ".github", "evidence"],
  changes,
  commands: [
    ["pnpm", "format:check"],
    ["pnpm", "lint"],
    ["pnpm", "typecheck"],
    ["pnpm", "test"],
    ["pnpm", "build"],
    ["pnpm", "diagnostics"],
  ],
  requiredChecks: [
    "format",
    "lint",
    "typecheck",
    "tests",
    "build",
    "diagnostics",
    "independent-verification",
  ],
  checkpointRemote: "checkpoint",
  rollback: { strategy: "revert", preserveHistory: true },
  cleanup: { deleteWorkspace: true, terminatePaidResources: true, verifyProviderZero: true },
  model: { provider: "ollama", name: "qwen3:8b" },
  createdAt: new Date().toISOString(),
};
await writeFile(outputPath, `${JSON.stringify(proposal, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
process.stdout.write(
  `${JSON.stringify({ proposalPath: outputPath, baseRevision, model: proposal.model, changes: changes.map(({ path, operation, beforeDigest, afterDigest, rationale }) => ({ path, operation, beforeDigest, afterDigest, rationale })) }, null, 2)}\n`,
);
