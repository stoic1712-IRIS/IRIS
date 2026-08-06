import {
  workerSpecificationSchema,
  type WorkerContext,
  type WorkerSpecification,
} from "./worker-contracts.js";

const sensitivityRank = {
  public: 0,
  internal: 1,
  sensitive: 2,
  secret: 3,
  "recovery-authority": 4,
} as const;

export function calculateMinimumPermissions(input: {
  readOnly: boolean;
  requestedPaths: string[];
  requestedWritePaths?: string[];
  requestedTools: string[];
}): WorkerSpecification["permissions"] {
  const readTools = new Set(["read-file", "list-files", "inspect-metadata"]);
  if (input.readOnly && input.requestedTools.some((tool) => !readTools.has(tool)))
    throw new Error("Read-only mission requested a mutating or unapproved tool.");
  return {
    tools: [...new Set(input.requestedTools)].sort(),
    readPaths: [...new Set(input.requestedPaths)].sort(),
    writePaths: input.readOnly ? [] : [...new Set(input.requestedWritePaths ?? [])].sort(),
    mayExpand: false,
  };
}

export function generateWorkerSpecification(
  input: Omit<WorkerSpecification, "permissions"> & {
    requestedPaths: string[];
    requestedWritePaths?: string[];
    requestedTools: string[];
    codingWorkerGatePassed: boolean;
  },
): WorkerSpecification {
  if (input.workerClass === "coding" && !input.codingWorkerGatePassed)
    throw new Error("Coding workers remain disabled until the read-only lifecycle gate passes.");
  const {
    requestedPaths,
    requestedWritePaths,
    requestedTools,
    codingWorkerGatePassed: _gate,
    ...rest
  } = input;
  void _gate;
  return workerSpecificationSchema.parse({
    ...rest,
    permissions: calculateMinimumPermissions({
      readOnly: input.workerClass === "read-only",
      requestedPaths,
      ...(requestedWritePaths === undefined ? {} : { requestedWritePaths }),
      requestedTools,
    }),
  });
}

export function assembleWorkerContext(input: {
  specification: WorkerSpecification;
  objective: string;
  repositoryFiles: WorkerContext["repositoryFiles"];
  memories: WorkerContext["memories"];
  constraints: string[];
}): WorkerContext {
  const specification = workerSpecificationSchema.parse(input.specification);
  const allowedFiles = input.repositoryFiles.filter((file) =>
    specification.permissions.readPaths.some(
      (allowed) => file.path === allowed || file.path.startsWith(`${allowed.replace(/\/$/, "")}/`),
    ),
  );
  const allowedMemories = input.memories
    .filter((memory) => specification.memory.categories.includes(memory.category))
    .filter(
      (memory) =>
        sensitivityRank[memory.sensitivity] <=
        sensitivityRank[specification.memory.maximumSensitivity],
    )
    .slice(0, specification.memory.maximumItems);
  return {
    objective: input.objective,
    repositoryFiles: structuredClone(allowedFiles),
    memories: structuredClone(allowedMemories),
    constraints: [...input.constraints],
  };
}

export function assignModel(input: {
  purpose: string;
  maximumGpuVramMiB: number;
  candidates: {
    provider: string;
    model: string;
    capabilities: string[];
    gpuVramMiB: number;
    priority: number;
  }[];
}): WorkerSpecification["model"] {
  const candidate = input.candidates
    .filter(
      (item) =>
        item.gpuVramMiB <= input.maximumGpuVramMiB && item.capabilities.includes(input.purpose),
    )
    .sort(
      (left, right) => right.priority - left.priority || left.model.localeCompare(right.model),
    )[0];
  if (candidate === undefined)
    throw new Error("No model satisfies the mission capability and resource boundary.");
  return { provider: candidate.provider, model: candidate.model, purpose: input.purpose };
}
