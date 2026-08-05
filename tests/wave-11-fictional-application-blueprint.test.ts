import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  compileDockerCompose,
  createRemovalManifest,
  createRollbackManifest,
  infrastructureBlueprintSchema,
  validateBlueprint,
} from "../packages/blueprints/src/index.js";

const fixtureUrl = new URL(
  "../examples/blueprints/fictional-disposable-bookshop.json",
  import.meta.url,
);

async function loadFixture() {
  return infrastructureBlueprintSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")));
}

describe("Wave 11 fictional disposable application decision gate", () => {
  it("validates independently from the canonical IRIS architecture blueprint", async () => {
    const blueprint = await loadFixture();
    expect(blueprint.id).toBe("fictional-bookshop");
    expect(blueprint.metadata.createdBy).toContain("acceptance fixture");
    expect(validateBlueprint(blueprint)).toEqual([]);
  });

  it("compiles a deterministic, private, digest-locked disposable deployment plan", async () => {
    const blueprint = await loadFixture();
    const first = compileDockerCompose(blueprint);
    const second = compileDockerCompose(blueprint);
    expect(first).toBe(second);
    expect(first).toContain("example.invalid/fictional/bookshop-api@sha256:");
    expect(first).toContain("bookshop-private:");
    expect(first).toContain("internal: true");
    expect(first).toContain("bookshop-database-password:");
    expect(first).not.toContain("password=");
  });

  it("produces complete cleanup and history-preserving rollback instructions", async () => {
    const blueprint = await loadFixture();
    const removal = createRemovalManifest(blueprint);
    expect(removal.commands).toEqual([
      ["docker", "compose", "down", "--remove-orphans"],
      ["docker", "compose", "rm", "--force", "--stop", "bookshop-database"],
      ["docker", "compose", "rm", "--force", "--stop", "bookshop-api"],
    ]);
    expect(removal.resources).toEqual([
      "service:bookshop-database",
      "service:bookshop-api",
      "network:bookshop-private",
      "secret-reference:bookshop-database-password",
    ]);
    expect(createRollbackManifest(blueprint)).toEqual({
      blueprintId: "fictional-bookshop",
      sourceRevision: "b5a91a2db02c1252bc907c4bf7d84d75a1bbd7b1",
      strategy: "history-preserving-revert",
      commands: [
        ["git", "revert", "b5a91a2db02c1252bc907c4bf7d84d75a1bbd7b1"],
        ["docker", "compose", "up", "--detach", "--remove-orphans"],
      ],
    });
  });
});
