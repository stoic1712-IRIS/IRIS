import path from "node:path";

export interface RepositoryFile {
  path: string;
  kind: "source" | "test" | "documentation" | "evidence" | "configuration" | "other";
  citation: string;
}

export interface RepositoryPackage {
  name: string;
  path: string;
  dependencies: string[];
  citation: string;
}

export interface RepositoryMap {
  files: RepositoryFile[];
  packages: RepositoryPackage[];
  dependencyEdges: { from: string; to: string }[];
  testFiles: string[];
  buildFiles: string[];
  protectedPaths: string[];
  citations: string[];
}

export function classifyRepositoryFile(filePath: string): RepositoryFile["kind"] {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.startsWith("tests/") || /\.test\.[cm]?[jt]sx?$/.test(normalized)) return "test";
  if (normalized.startsWith("docs/")) return "documentation";
  if (normalized.startsWith("evidence/")) return "evidence";
  if (/\.(ts|tsx|js|mjs|cjs)$/.test(normalized) && normalized.includes("/src/")) return "source";
  if (
    /^(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|eslint.*|prettier.*)$/.test(
      path.posix.basename(normalized),
    )
  )
    return "configuration";
  return "other";
}

export function buildRepositoryMap(input: {
  files: string[];
  packages: { name: string; path: string; dependencies: string[] }[];
  protectedPaths: string[];
}): RepositoryMap {
  const files = [...new Set(input.files.map((file) => file.replaceAll("\\", "/")))]
    .sort()
    .map((file) => ({
      path: file,
      kind: classifyRepositoryFile(file),
      citation: `repository:${file}`,
    }));
  const packages = input.packages
    .map((item) => ({
      ...item,
      dependencies: [...item.dependencies].sort(),
      citation: `repository:${item.path}/package.json`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const known = new Set(packages.map((item) => item.name));
  const dependencyEdges = packages.flatMap((item) =>
    item.dependencies
      .filter((dependency) => known.has(dependency))
      .map((dependency) => ({ from: item.name, to: dependency })),
  );
  return {
    files,
    packages,
    dependencyEdges,
    testFiles: files.filter((file) => file.kind === "test").map((file) => file.path),
    buildFiles: files.filter((file) => file.kind === "configuration").map((file) => file.path),
    protectedPaths: [...input.protectedPaths].sort(),
    citations: [...files.map((file) => file.citation), ...packages.map((item) => item.citation)],
  };
}

export function explainRepository(map: RepositoryMap): { summary: string; citations: string[] } {
  return {
    summary: `Repository contains ${String(map.packages.length)} IRIS packages, ${String(map.files.length)} tracked files, ${String(map.testFiles.length)} test files, and ${String(map.dependencyEdges.length)} internal dependency edges.`,
    citations: [...map.citations],
  };
}
