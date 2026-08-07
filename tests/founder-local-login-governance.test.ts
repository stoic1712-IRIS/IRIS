import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Founder local login governance", () => {
  it("supersedes pairing without transferring Core authority", async () => {
    const specification = await readFile("docs/specifications/founder-local-login.md", "utf8");
    expect(specification).toContain("**Status:** Canonical version 1.0.0");
    expect(specification).toContain("supersedes the active pairing-bootstrap rule");
    expect(specification).toContain("IRIS Core remains the sole authority");
    expect(specification).toContain("127.0.0.1");
    expect(specification).not.toContain("public listener");
  });

  it("binds exact paths and excludes credential material", async () => {
    const task = JSON.parse(
      await readFile(".iris/coordination/tasks/founder-local-login.json", "utf8"),
    ) as {
      task_id: string;
      phase0_graduation: boolean;
      allowed_paths: string[];
      prohibited_actions: string[];
    };
    expect(task.task_id).toBe("founder-local-login");
    expect(task.phase0_graduation).toBe(false);
    expect(task.allowed_paths).toContain("scripts/founder-auth.mjs");
    expect(task.prohibited_actions.join(" ")).toMatch(/credential disclosure/iu);
  });
});
