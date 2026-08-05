import {
  infrastructureBlueprintSchema,
  type InfrastructureBlueprint,
  type ValidationFinding,
} from "./contracts.js";
import { profileLimits } from "./profiles.js";

function finding(
  severity: ValidationFinding["severity"],
  code: ValidationFinding["code"],
  path: string,
  message: string,
): ValidationFinding {
  return { severity, code, path, message };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return [
    ...new Set(values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)))),
  ];
}

function dependencyCycles(blueprint: InfrastructureBlueprint): string[][] {
  const graph = new Map(blueprint.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of blueprint.edges)
    if (edge.kind === "dependency") graph.get(edge.source)?.push(edge.target);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];
  const walk = (node: string, path: string[]): void => {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      cycles.push([...path.slice(Math.max(0, start)), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) walk(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of graph.keys()) walk(node, []);
  return cycles;
}

export function validateBlueprint(input: InfrastructureBlueprint): ValidationFinding[] {
  const blueprint = infrastructureBlueprintSchema.parse(input);
  const findings: ValidationFinding[] = [];
  const nodeIds = new Set(blueprint.nodes.map((node) => node.id));
  const networkIds = new Set(blueprint.networks.map((network) => network.id));
  const secretIds = new Set(blueprint.secrets.map((secret) => secret.id));
  for (const id of duplicates([
    ...blueprint.nodes.map((node) => node.id),
    ...blueprint.edges.map((edge) => edge.id),
    ...blueprint.networks.map((network) => network.id),
    ...blueprint.secrets.map((secret) => secret.id),
  ]))
    findings.push(finding("error", "duplicate-id", id, `Identifier ${id} is not globally unique.`));
  for (const edge of blueprint.edges) {
    if (!nodeIds.has(edge.source))
      findings.push(
        finding(
          "error",
          "missing-endpoint",
          `edges.${edge.id}.source`,
          `Source node ${edge.source} does not exist.`,
        ),
      );
    if (!nodeIds.has(edge.target))
      findings.push(
        finding(
          "error",
          "missing-endpoint",
          `edges.${edge.id}.target`,
          `Target node ${edge.target} does not exist.`,
        ),
      );
    if (edge.network !== undefined && !networkIds.has(edge.network))
      findings.push(
        finding(
          "error",
          "missing-network",
          `edges.${edge.id}.network`,
          `Network ${edge.network} is undefined.`,
        ),
      );
  }
  const ports = new Map<string, string>();
  let hourlyCost = 0;
  const totals = { cpuCores: 0, memoryMiB: 0, storageGiB: 0, gpuCount: 0 };
  for (const node of blueprint.nodes) {
    hourlyCost += node.resources.hourlyCostUsd;
    totals.cpuCores += node.resources.cpuCores;
    totals.memoryMiB += node.resources.memoryMiB;
    totals.storageGiB += node.resources.storageGiB;
    totals.gpuCount += node.resources.gpuCount;
    if (
      blueprint.policy.requireDigestLocks &&
      node.image !== undefined &&
      !node.image.digest.startsWith("sha256:")
    )
      findings.push(
        finding(
          "error",
          "missing-lock",
          `nodes.${node.id}.image`,
          "Image must use an immutable digest.",
        ),
      );
    if (
      blueprint.policy.requireDigestLocks &&
      node.source !== undefined &&
      node.source.revision.length < 40
    )
      findings.push(
        finding(
          "error",
          "missing-lock",
          `nodes.${node.id}.source`,
          "Source revision must be an immutable full revision.",
        ),
      );
    for (const network of node.networks)
      if (!networkIds.has(network))
        findings.push(
          finding(
            "error",
            "missing-network",
            `nodes.${node.id}.networks`,
            `Network ${network} is undefined.`,
          ),
        );
    for (const secret of node.secrets)
      if (!secretIds.has(secret))
        findings.push(
          finding(
            "error",
            "missing-secret",
            `nodes.${node.id}.secrets`,
            `Secret ${secret} is undefined.`,
          ),
        );
    for (const port of node.ports) {
      if (
        port.exposure === "public" &&
        (!blueprint.policy.allowPublicExposure ||
          !profileLimits[blueprint.profile].allowPublicExposure)
      )
        findings.push(
          finding(
            "error",
            "public-exposure",
            `nodes.${node.id}.ports`,
            `Public port ${String(port.container)} is forbidden in ${blueprint.profile}.`,
          ),
        );
      if (port.host !== undefined) {
        const key = `${String(port.host)}/${port.protocol}`;
        const owner = ports.get(key);
        if (owner !== undefined)
          findings.push(
            finding(
              "error",
              "port-collision",
              `nodes.${node.id}.ports`,
              `Host port ${key} collides with ${owner}.`,
            ),
          );
        else ports.set(key, node.id);
      }
    }
    if (
      blueprint.policy.requireNonRoot &&
      (!node.security.runAsNonRoot || !node.security.noNewPrivileges)
    )
      findings.push(
        finding(
          "error",
          "security-policy",
          `nodes.${node.id}.security`,
          "Node must run non-root with no-new-privileges.",
        ),
      );
  }
  for (const cycle of dependencyCycles(blueprint))
    findings.push(
      finding("error", "dependency-cycle", "edges", `Dependency cycle: ${cycle.join(" -> ")}.`),
    );
  const limits = profileLimits[blueprint.profile];
  for (const key of Object.keys(totals) as (keyof typeof totals)[])
    if (totals[key] > limits[key])
      findings.push(
        finding(
          "error",
          "capacity-exceeded",
          `resources.${key}`,
          `${key} ${String(totals[key])} exceeds ${blueprint.profile} capacity ${String(limits[key])}.`,
        ),
      );
  const adjustedCost = hourlyCost * limits.costMultiplier;
  if (adjustedCost > blueprint.policy.maxHourlyCostUsd)
    findings.push(
      finding(
        "error",
        "cost-exceeded",
        "policy.maxHourlyCostUsd",
        `Estimated hourly cost ${adjustedCost.toFixed(2)} exceeds ${blueprint.policy.maxHourlyCostUsd.toFixed(2)}.`,
      ),
    );
  return findings;
}

export function assertValidBlueprint(blueprint: InfrastructureBlueprint): void {
  const errors = validateBlueprint(blueprint).filter(({ severity }) => severity === "error");
  if (errors.length > 0)
    throw new Error(errors.map(({ code, message }) => `${code}: ${message}`).join("\n"));
}
