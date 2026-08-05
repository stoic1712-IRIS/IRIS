import type { InfrastructureBlueprint } from "./contracts.js";

export interface RemovalManifest {
  readonly blueprintId: string;
  readonly commands: readonly (readonly string[])[];
  readonly resources: readonly string[];
}

export interface RollbackManifest {
  readonly blueprintId: string;
  readonly sourceRevision: string;
  readonly strategy: "history-preserving-revert";
  readonly commands: readonly (readonly string[])[];
}

export function createRemovalManifest(blueprint: InfrastructureBlueprint): RemovalManifest {
  const services = [...blueprint.nodes]
    .filter(({ kind }) => kind !== "external" && kind !== "volume")
    .map(({ id }) => id)
    .sort()
    .reverse();
  return Object.freeze({
    blueprintId: blueprint.id,
    commands: Object.freeze([
      Object.freeze(["docker", "compose", "down", "--remove-orphans"]),
      ...services.map((service) =>
        Object.freeze(["docker", "compose", "rm", "--force", "--stop", service]),
      ),
    ]),
    resources: Object.freeze([
      ...services.map((service) => `service:${service}`),
      ...blueprint.networks.map(({ id }) => `network:${id}`),
      ...blueprint.secrets.map(({ id }) => `secret-reference:${id}`),
    ]),
  });
}

export function createRollbackManifest(blueprint: InfrastructureBlueprint): RollbackManifest {
  return Object.freeze({
    blueprintId: blueprint.id,
    sourceRevision: blueprint.metadata.sourceRevision,
    strategy: "history-preserving-revert",
    commands: Object.freeze([
      Object.freeze(["git", "revert", blueprint.metadata.sourceRevision]),
      Object.freeze(["docker", "compose", "up", "--detach", "--remove-orphans"]),
    ]),
  });
}
