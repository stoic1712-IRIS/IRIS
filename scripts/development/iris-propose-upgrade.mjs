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
const requestFile = async ({ path, operation, instructions, context, numPredict, validate }) => {
  let validationFeedback = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = `You are IRIS, operating a governed self-upgrade proposal workflow. Generate only the exact complete content for ${path}. This is a ${operation} operation. Do not use Markdown fences. Preserve existing behavior and follow every constraint below.\n\n${instructions}\n\n${validationFeedback}\nCanonical context:\n${JSON.stringify(context)}`;
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
    let result;
    try {
      result = JSON.parse((await response.json()).message.content);
    } catch (error) {
      validationFeedback = `The previous response was not valid JSON: ${error.message}. Return a shorter valid response.`;
      continue;
    }
    const errors = result.content.trim() === "" ? ["content is empty"] : validate(result.content);
    if (errors.length === 0)
      return { path, operation, content: result.content, rationale: result.rationale };
    validationFeedback = `The previous content failed validation: ${errors.join("; ")}. Correct every issue.`;
  }
  throw new Error(`Model failed bounded semantic validation for ${path}: ${validationFeedback}`);
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
const assessment = await requestFile({
  path: "the bounded Wave 10 upgrade assessment",
  operation: "inspect and propose",
  instructions: `Inspect the canonical sources. In content, write a single concise objective for adding a deterministic immutable self-description to the Sovereign Development Runtime. In rationale, explain why the four-file implementation, public export, exact capability contract, tests, and specification are a useful bounded self-upgrade. Do not write source code.`,
  context: sourceContext,
  numPredict: 500,
  validate: (content) =>
    content.length <= 600 && /self-description/i.test(content)
      ? []
      : ["objective must be concise and identify the self-description upgrade"],
});
const capabilitySource = capabilities.map((capability) => `    \"${capability}\",`).join("\n");
const selfDescription = {
  path: "packages/development/src/self-description.ts",
  operation: "create",
  content: `export interface SovereignDevelopmentSelfDescription {
  readonly name: \"STOIC-IRIS\";
  readonly runtime: \"sovereign-development-runtime\";
  readonly capabilities: readonly string[];
  readonly graduationEvidenceComplete: false;
}

export function getSovereignDevelopmentSelfDescription(): SovereignDevelopmentSelfDescription {
  const capabilities = Object.freeze([
${capabilitySource}
  ]);
  return Object.freeze({
    name: \"STOIC-IRIS\",
    runtime: \"sovereign-development-runtime\",
    capabilities,
    graduationEvidenceComplete: false,
  });
}
`,
  rationale: assessment.rationale,
};
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
    "Expose IRIS's governed self-description through the existing public development package index.",
};
const capabilityAssertions = capabilities
  .map((capability) => `      \"${capability}\",`)
  .join("\n");
const testFile = {
  path: "tests/wave-10-graduation-self-description.test.ts",
  operation: "create",
  content: `import { describe, expect, it } from \"vitest\";

import { getSovereignDevelopmentSelfDescription } from \"../packages/development/src/index.js\";

describe(\"Wave 10 graduation self-description\", () => {
  it(\"returns the exact immutable capability contract\", () => {
    const description = getSovereignDevelopmentSelfDescription();
    expect(description.graduationEvidenceComplete).toBe(false);
    expect(description.capabilities).toEqual([
${capabilityAssertions}
    ]);
    expect(Object.isFrozen(description)).toBe(true);
    expect(Object.isFrozen(description.capabilities)).toBe(true);
  });

  it(\"returns distinct object and array identities\", () => {
    const first = getSovereignDevelopmentSelfDescription();
    const second = getSovereignDevelopmentSelfDescription();
    expect(first).not.toBe(second);
    expect(first.capabilities).not.toBe(second.capabilities);
  });
});
`,
  rationale: "Verify the exact public, immutable, and per-call-distinct self-description contract.",
};
const documentation = {
  path: "docs/specifications/wave-10-graduation-self-description.md",
  operation: "create",
  content: `# Wave 10 Graduation Self-Description

## Purpose

The development package exposes a deterministic description of the sovereign development runtime's governed capabilities and current graduation status.

## Contract

- The system name is \`STOIC-IRIS\`.
- The runtime is \`sovereign-development-runtime\`.
- Capabilities appear in the canonical order encoded by the implementation and tests.
- \`graduationEvidenceComplete\` remains \`false\` until the full Founder-operated graduation workflow succeeds.

## Immutability and determinism

Each call returns a distinct object and capabilities array. Both are frozen. Their values and order remain deterministic.

## Validation

Tests verify the exact capability list, frozen object and array, incomplete graduation status, and distinct identities across calls. The standard format, lint, typecheck, test, build, diagnostics, and independent verification checks remain mandatory.

## Graduation boundary

Machinery readiness and this self-description are not Phase 0 graduation evidence. Graduation remains incomplete until IRIS completes the genuine Founder-operated governed workflow end to end, including private checkpointing, remote equality, rollback evidence, cleanup, paid-resource termination, and provider-authoritative zero-resource verification.
`,
  rationale: "Define the deterministic contract and preserve the Phase 0 graduation boundary.",
};
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
  objective: assessment.content,
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
