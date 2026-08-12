#!/usr/bin/env node
// Claude Code PreToolUse guard for digest-bound operating-contract sources.
//
// Editing one of the sources pinned in config/iris-operating-contract.v1.json changes its
// SHA-256, so `pnpm contract:compile` fails with OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH and
// the Founder runtime will not start. Commit 52b0c41 records that outage; the remote-control
// delivery reproduced it. Both shipped because the change was Markdown only, so full
// verification looked unnecessary.
//
// This guard turns that silent coupling into a prompt. It never blocks: any malformed input,
// missing file, or unexpected error exits 0 with no decision, so ordinary work is unaffected.

import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REBIND_PROCEDURE =
  "To change it: edit the source, update its digest in config/iris-operating-contract.v1.json, " +
  "rerun the compiler without --check to regenerate generated/iris-operating-contract.compiled.json, " +
  "then run pnpm verify. See commit 52b0c41 for the recorded procedure.";

function allow() {
  process.exit(0);
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function repositoryRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function boundSources(root) {
  const config = JSON.parse(
    readFileSync(resolve(root, "config/iris-operating-contract.v1.json"), "utf8"),
  );
  if (!Array.isArray(config.sources)) return [];
  return config.sources.filter((source) => typeof source?.path === "string");
}

function toRepositoryPath(root, filePath, cwd) {
  const absolute = resolve(cwd ?? root, filePath);
  const relativePath = relative(root, absolute);
  if (relativePath === "" || relativePath.startsWith("..")) return null;
  return relativePath.split(sep).join("/");
}

const raw = readStdin();
if (raw.trim() === "") allow();

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  allow();
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== "string" || filePath === "") allow();

const root = repositoryRoot();

let sources;
try {
  sources = boundSources(root);
} catch {
  allow();
}

const repositoryPath = toRepositoryPath(root, filePath, payload?.cwd);
if (repositoryPath === null) allow();

const match = sources.find((source) => source.path === repositoryPath);
if (match === undefined) allow();

const reason =
  `${repositoryPath} is a digest-bound source of the canonical operating contract ` +
  `(role: ${match.role ?? "unknown"}, pinned ${match.digest ?? "unknown"}). ` +
  `Editing it changes its SHA-256, so pnpm contract:compile will fail with ` +
  `OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH and the Founder runtime will not start. ` +
  REBIND_PROCEDURE;

process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: reason,
    },
  })}\n`,
);
process.exit(0);
