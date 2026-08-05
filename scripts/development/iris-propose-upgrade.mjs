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

const fileSchema = {
  type: "object",
  properties: {
    content: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["content", "rationale"],
  additionalProperties: false,
};
const requestFile = async ({ path, operation, instructions, context, numPredict }) => {
  const prompt = `You are IRIS, operating a governed self-upgrade proposal workflow. Generate only the exact complete content for ${path}. This is a ${operation} operation. Do not use Markdown fences. Preserve existing behavior and follow every constraint below.\n\n${instructions}\n\nCanonical context:\n${JSON.stringify(context)}`;
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "qwen3:8b",
      messages: [{ role: "user", content: prompt }],
      stream: false,
      think: false,
      format: fileSchema,
      options: { temperature: 0, num_ctx: 16384, num_predict: numPredict },
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!response.ok) throw new Error(`Ollama request failed for ${path}: ${response.status}`);
  const result = JSON.parse((await response.json()).message.content);
  if (result.content.trim() === "") throw new Error(`Model returned empty content for ${path}`);
  return { path, operation, content: result.content, rationale: result.rationale };
};

const capabilities = [
  "exact-bounded-proposal",
  "typed-founder-approval",
  "disposable-git-workspace",
  "allowed-path-enforcement",
  "governed-command-execution",
  "multi-file-editing",
  "tests-and-builds",
  "independent-verification",
  "repair-and-reapproval",
  "private-checkpoint",
  "remote-equality-verification",
  "history-preserving-rollback",
  "workspace-cleanup",
  "paid-resource-termination",
  "provider-authoritative-zero-verification",
];
const sourceContext = { baseRevision, sources, capabilities };
const selfDescription = await requestFile({
  path: "packages/development/src/self-description.ts",
  operation: "create",
  instructions: `Create a dependency-free TypeScript module. Export a readonly SovereignDevelopmentSelfDescription interface and getSovereignDevelopmentSelfDescription function. The returned value must identify STOIC-IRIS, describe the sovereign development runtime, contain exactly the supplied capabilities in their supplied order, and set graduationEvidenceComplete to false. Every call must return a distinct object and distinct capabilities array. Deeply freeze both the object and its capabilities array. Use no imports. Keep the file under 80 lines.`,
  context: sourceContext,
  numPredict: 1200,
});
const indexSource = sources.find(
  ({ path }) => path === "packages/development/src/index.ts",
)?.content;
if (indexSource === undefined || indexSource === "<absent>")
  throw new Error("Canonical development index is unavailable.");
const selfDescriptionExport = 'export * from "./self-description.js";';
const indexFile = {
  path: "packages/development/src/index.ts",
  operation: "update",
  content: indexSource.includes(selfDescriptionExport)
    ? indexSource
    : `${indexSource.trimEnd()}\n${selfDescriptionExport}\n`,
  rationale:
    "Expose the model-generated self-description through the existing public development package index.",
};
const testFile = await requestFile({
  path: "tests/wave-10-graduation-self-description.test.ts",
  operation: "create",
  instructions: `Create a concise Vitest test file for the new public export. Assert the exact capability list, graduationEvidenceComplete false, Object.isFrozen for the returned object and capabilities array, and distinct object and array identities across two calls. Do not use unsafe casts or mutation attempts. Use repository import conventions from the supplied tests. Keep the file under 100 lines.`,
  context: {
    sources,
    selfDescription: selfDescription.content,
    index: indexFile.content,
    capabilities,
  },
  numPredict: 1600,
});
const documentation = await requestFile({
  path: "docs/specifications/wave-10-graduation-self-description.md",
  operation: "create",
  instructions: `Write a concise specification for the deterministic self-description capability. Include purpose, contract, immutability/determinism, capability meanings, and validation. State unambiguously that machinery/readiness and this self-description are not Phase 0 graduation evidence; graduation remains incomplete until the Founder-operated governed workflow succeeds end to end. Keep it under 140 lines.`,
  context: { selfDescription: selfDescription.content, capabilities },
  numPredict: 1800,
});
const modelChanges = [selfDescription, indexFile, testFile, documentation];
const digest = (text) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const allowedPaths = ["packages/development/src", "tests", "docs/specifications"];
const changes = [];
for (const change of modelChanges) {
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
  objective:
    "Add a deterministic, immutable self-description capability to the Sovereign Development Runtime with public export, tests, and documentation.",
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
