import type { InfrastructureBlueprint } from "./contracts.js";
import { assertValidBlueprint } from "./validator.js";

function scalar(value: string | number | boolean): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function linesForRecord(record: Readonly<Record<string, string>>, indent: string): string[] {
  return Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${indent}${key}: ${scalar(value)}`);
}

export function compileDockerCompose(blueprint: InfrastructureBlueprint): string {
  assertValidBlueprint(blueprint);
  const lines = ["name: " + scalar(blueprint.id), "services:"];
  for (const node of [...blueprint.nodes]
    .filter(({ kind }) => kind !== "external" && kind !== "volume")
    .sort((a, b) => a.id.localeCompare(b.id))) {
    if (node.image === undefined) throw new Error(`Image missing for ${node.id}.`);
    lines.push(
      `  ${node.id}:`,
      `    image: ${scalar(`${node.image.repository}@${node.image.digest}`)}`,
    );
    if (node.command.length > 0)
      lines.push("    command:", ...node.command.map((part) => `      - ${scalar(part)}`));
    if (Object.keys(node.environment).length > 0)
      lines.push("    environment:", ...linesForRecord(node.environment, "      "));
    if (node.networks.length > 0)
      lines.push(
        "    networks:",
        ...[...node.networks].sort().map((network) => `      - ${network}`),
      );
    if (node.secrets.length > 0)
      lines.push("    secrets:", ...[...node.secrets].sort().map((secret) => `      - ${secret}`));
    if (node.ports.length > 0)
      lines.push(
        "    ports:",
        ...node.ports.map(
          (port) =>
            `      - ${scalar(`${String(port.host ?? "127.0.0.1")}:${String(port.container)}/${port.protocol}`)}`,
        ),
      );
    lines.push(
      `    read_only: ${String(node.security.readOnlyRootFilesystem)}`,
      `    user: ${scalar(node.security.runAsNonRoot ? "65532:65532" : "0:0")}`,
      "    cap_drop:",
      `      - ${scalar(node.security.dropAllCapabilities ? "ALL" : "")}`,
      "    security_opt:",
      `      - ${scalar(node.security.noNewPrivileges ? "no-new-privileges:true" : "no-new-privileges:false")}`,
      "    deploy:",
      "      resources:",
      "        limits:",
      `          cpus: ${scalar(node.resources.cpuCores.toFixed(2))}`,
      `          memory: ${scalar(`${String(node.resources.memoryMiB)}M`)}`,
    );
    if (node.healthcheck !== undefined)
      lines.push(
        "    healthcheck:",
        "      test:",
        ...node.healthcheck.test.map((part) => `        - ${scalar(part)}`),
        `      interval: ${scalar(`${String(node.healthcheck.intervalSeconds)}s`)}`,
      );
  }
  if (blueprint.networks.length > 0) {
    lines.push("networks:");
    for (const network of [...blueprint.networks].sort((a, b) => a.id.localeCompare(b.id)))
      lines.push(`  ${network.id}:`, `    internal: ${String(network.internal)}`);
  }
  if (blueprint.secrets.length > 0) {
    lines.push("secrets:");
    for (const secret of [...blueprint.secrets].sort((a, b) => a.id.localeCompare(b.id)))
      lines.push(`  ${secret.id}:`, `    external: true`, `    name: ${scalar(secret.id)}`);
  }
  return `${lines.join("\n")}\n`;
}
