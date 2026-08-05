import { describe, expect, it } from "vitest";

import {
  assertValidBlueprint,
  compileDockerCompose,
  createRemovalManifest,
  createRollbackManifest,
  infrastructureBlueprintSchema,
  validateBlueprint,
  type InfrastructureBlueprint,
} from "../packages/blueprints/src/index.js";
import {
  blueprintDiff,
  createPaletteNode,
  fromFlow,
  layoutFlow,
  toFlow,
} from "../apps/visual-composer/src/model.js";
import { sampleBlueprint } from "../apps/visual-composer/src/sample-blueprint.js";

function clone(): InfrastructureBlueprint {
  return infrastructureBlueprintSchema.parse(structuredClone(sampleBlueprint));
}

describe("Wave 11 portable blueprint engine", () => {
  it("parses immutable node, edge, profile, policy, resource, and approval contracts", () => {
    const blueprint = clone();
    expect(blueprint.apiVersion).toBe("iris.stoic/v1");
    expect(blueprint.nodes.every((node) => node.image?.digest.startsWith("sha256:"))).toBe(true);
    expect(() =>
      infrastructureBlueprintSchema.parse({ ...blueprint, approvalStatus: "self-approved" }),
    ).toThrow();
  });

  it("supports governed custom nodes without weakening the base schema", () => {
    const custom = createPaletteNode("custom", "custom-provider");
    expect(custom).toMatchObject({ kind: "custom", customType: "custom-provider" });
    expect(() =>
      infrastructureBlueprintSchema.parse({
        ...clone(),
        nodes: [{ ...custom, customType: undefined }],
      }),
    ).toThrow(/customType/);
  });

  it("detects missing secrets, port collisions, forbidden exposure, dependency cycles, cost, and capacity", () => {
    const blueprint = clone();
    const api = blueprint.nodes[0];
    const store = blueprint.nodes[1];
    if (api === undefined || store === undefined) throw new Error("Fixture nodes missing.");
    const invalid = infrastructureBlueprintSchema.parse({
      ...blueprint,
      profile: "development",
      secrets: [],
      policy: { ...blueprint.policy, maxHourlyCostUsd: 1 },
      nodes: [
        {
          ...api,
          ports: [{ container: 3000, host: 3000, protocol: "tcp", exposure: "public" }],
          resources: { ...api.resources, cpuCores: 10, hourlyCostUsd: 2 },
        },
        {
          ...store,
          ports: [{ container: 5432, host: 3000, protocol: "tcp", exposure: "host" }],
          resources: { ...store.resources, cpuCores: 10 },
        },
      ],
      edges: [
        ...blueprint.edges,
        {
          id: "memory-api",
          source: "memory-store",
          target: "iris-api",
          kind: "dependency",
          required: true,
        },
      ],
    });
    const codes = validateBlueprint(invalid).map(({ code }) => code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "missing-secret",
        "port-collision",
        "public-exposure",
        "dependency-cycle",
        "capacity-exceeded",
      ]),
    );
    expect(() => {
      assertValidBlueprint(invalid);
    }).toThrow(/missing-secret/);
  });

  it("compiles deterministic locked Docker Compose with network, secret, security, resource, and health policy", () => {
    const first = compileDockerCompose(clone());
    const second = compileDockerCompose(clone());
    expect(first).toBe(second);
    expect(first).toContain("services:");
    expect(first).toContain("ghcr.io/stoic-iris/api@sha256:");
    expect(first).toContain("no-new-privileges:true");
    expect(first).toContain("database-password:");
    expect(first).toContain("internal: true");
  });

  it("creates explicit history-preserving rollback and removal manifests", () => {
    const blueprint = clone();
    expect(createRollbackManifest(blueprint)).toMatchObject({
      strategy: "history-preserving-revert",
      sourceRevision: blueprint.metadata.sourceRevision,
    });
    const removal = createRemovalManifest(blueprint);
    expect(removal.commands[0]).toEqual(["docker", "compose", "down", "--remove-orphans"]);
    expect(removal.resources).toContain("network:iris-private");
  });
});

describe("Wave 11 visual composer model", () => {
  it("round-trips portable blueprints through replaceable visual nodes and edges", () => {
    const blueprint = clone();
    const flow = toFlow(blueprint);
    expect(fromFlow(blueprint, flow.nodes, flow.edges)).toMatchObject({
      nodes: blueprint.nodes,
      edges: blueprint.edges,
    });
  });

  it("produces useful blueprint diffs", () => {
    const before = clone();
    const after = clone();
    const first = after.nodes[0];
    if (first === undefined) throw new Error("Fixture node missing.");
    after.nodes = [{ ...first, name: "Renamed API" }, ...after.nodes.slice(1)];
    after.profile = "test";
    expect(blueprintDiff(before, after)).toEqual([
      "Changed node iris-api",
      "Profile changed from development to test",
    ]);
  });

  it("lays out large graphs through the replaceable ELK provider", async () => {
    const flow = toFlow(clone());
    const laidOut = await layoutFlow(flow.nodes, flow.edges);
    expect(laidOut).toHaveLength(flow.nodes.length);
    expect(
      laidOut.every(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y)),
    ).toBe(true);
  });
});
