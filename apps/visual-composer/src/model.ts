import type { BlueprintEdge, BlueprintNode, InfrastructureBlueprint } from "@stoic-iris/blueprints";
import type { Edge, Node } from "@xyflow/react";
import ELKModule from "elkjs/lib/elk.bundled.js";

export interface ComposerNodeData extends Record<string, unknown> {
  blueprint: BlueprintNode;
  health: "healthy" | "degraded" | "unknown";
  logs: readonly string[];
}
export type ComposerNode = Node<ComposerNodeData>;

export const paletteKinds = [
  "service",
  "database",
  "queue",
  "model",
  "worker",
  "gateway",
  "custom",
] as const;

interface ElkNode {
  readonly id: string;
  readonly x?: number;
  readonly y?: number;
}

const ELK = ELKModule as unknown as new () => {
  layout(input: object): Promise<{ readonly children?: readonly ElkNode[] }>;
};

export function toFlow(blueprint: InfrastructureBlueprint): {
  nodes: ComposerNode[];
  edges: Edge[];
} {
  return {
    nodes: blueprint.nodes.map((node, index) => ({
      id: node.id,
      position: { x: 80 + (index % 3) * 280, y: 80 + Math.floor(index / 3) * 180 },
      data: {
        blueprint: node,
        health: "unknown",
        logs: ["No runtime attached; health is descriptive only."],
      },
      ariaLabel: `${node.name}, ${node.kind} infrastructure node`,
    })),
    edges: blueprint.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.kind,
      data: { blueprint: edge },
      ariaLabel: `${edge.kind} from ${edge.source} to ${edge.target}`,
    })),
  };
}

export function fromFlow(
  base: InfrastructureBlueprint,
  nodes: ComposerNode[],
  edges: Edge[],
): InfrastructureBlueprint {
  return {
    ...base,
    nodes: nodes.map(({ data }) => data.blueprint),
    edges: edges.map((edge) => {
      const original = edge.data?.blueprint as BlueprintEdge | undefined;
      return original === undefined
        ? {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            kind: "dependency" as const,
            required: true,
          }
        : { ...original, id: edge.id, source: edge.source, target: edge.target };
    }),
  };
}

export function createPaletteNode(kind: (typeof paletteKinds)[number], id: string): BlueprintNode {
  const executable =
    kind !== "custom"
      ? { repository: `example.invalid/iris/${kind}`, digest: `sha256:${"0".repeat(64)}` }
      : { repository: "example.invalid/iris/custom", digest: `sha256:${"0".repeat(64)}` };
  return {
    id,
    name: kind === "custom" ? "Custom Node" : `${kind[0]?.toUpperCase() ?? ""}${kind.slice(1)}`,
    kind,
    ...(kind === "custom" ? { customType: "custom-provider" } : {}),
    image: executable,
    command: [],
    environment: {},
    ports: [],
    networks: [],
    secrets: [],
    resources: { cpuCores: 1, memoryMiB: 512, storageGiB: 0, gpuCount: 0, hourlyCostUsd: 0 },
    security: {
      runAsNonRoot: true,
      readOnlyRootFilesystem: true,
      dropAllCapabilities: true,
      noNewPrivileges: true,
    },
    provenance: { source: "Founder palette", license: "UNRESOLVED", version: "proposal" },
  };
}

export async function layoutFlow(nodes: ComposerNode[], edges: Edge[]): Promise<ComposerNode[]> {
  const elk = new ELK();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "70",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
    },
    children: nodes.map((node) => ({ id: node.id, width: 220, height: 110 })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });
  const positions = new Map(
    (graph.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]),
  );
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }));
}

export function blueprintDiff(
  previous: InfrastructureBlueprint,
  current: InfrastructureBlueprint,
): string[] {
  const before = new Map(previous.nodes.map((node) => [node.id, JSON.stringify(node)]));
  const after = new Map(current.nodes.map((node) => [node.id, JSON.stringify(node)]));
  const changes: string[] = [];
  for (const id of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    if (!before.has(id)) changes.push(`Added node ${id}`);
    else if (!after.has(id)) changes.push(`Removed node ${id}`);
    else if (before.get(id) !== after.get(id)) changes.push(`Changed node ${id}`);
  }
  if (JSON.stringify(previous.edges) !== JSON.stringify(current.edges))
    changes.push("Connections changed");
  if (previous.profile !== current.profile)
    changes.push(`Profile changed from ${previous.profile} to ${current.profile}`);
  return changes;
}
