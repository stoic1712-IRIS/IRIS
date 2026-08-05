import { readFile } from "node:fs/promises";

const manifestPath = process.argv[2];
if (manifestPath === undefined) throw new Error("A manifest path is required.");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.entries) || manifest.entries.length === 0)
  throw new Error("The evidence manifest must contain entries.");
const citations = manifest.entries.map((entry) => {
  if (typeof entry.path !== "string" || entry.path.startsWith("/") || entry.path.includes(".."))
    throw new Error("Evidence paths must be bounded relative paths.");
  if (typeof entry.digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(entry.digest))
    throw new Error("Evidence entries require SHA-256 digests.");
  return `evidence:${entry.path}`;
});
process.stdout.write(
  `${JSON.stringify({ valid: true, checked: citations.length, citations, runtime: "iris-native" })}\n`,
);
