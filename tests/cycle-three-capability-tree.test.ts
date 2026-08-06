import { describe, expect, it } from "vitest";

import { validateCapabilityTree } from "../packages/workers/src/index.js";

const leaf = {
  id: "capability_complex-coding",
  name: "Complex coding",
  description: "Prepare bounded, independently verified repository changes.",
  status: "restricted" as const,
  workerIds: ["worker_complex-coder"],
  dependencies: ["capability_supervision"],
  evidence: ["Cycle Two governed complex-worker verification"],
  authorizationRequirement: "typed-protected-approval" as const,
  internetAccess: "none" as const,
  children: [],
};

describe("Cycle Three capability tree", () => {
  it("accepts a unique, evidence-bound hierarchy without mutating memory", () => {
    const tree = validateCapabilityTree({
      root: {
        id: "capability_iris",
        name: "IRIS",
        description: "Founder-governed cognitive supervisor.",
        status: "available",
        workerIds: [],
        dependencies: [],
        evidence: ["Canonical Cycle Two completion"],
        authorizationRequirement: "none",
        internetAccess: "none",
        children: [leaf],
      },
      generatedAt: "2026-08-06T04:00:00.000Z",
      canonicalMemoryMutation: false,
    });
    expect(tree.root.children[0]?.workerIds).toEqual(["worker_complex-coder"]);
    expect(tree.canonicalMemoryMutation).toBe(false);
  });

  it("rejects duplicate capability identities", () => {
    expect(() =>
      validateCapabilityTree({
        root: {
          ...leaf,
          id: "capability_root",
          children: [{ ...leaf, id: "capability_root" }],
        },
        generatedAt: "2026-08-06T04:00:00.000Z",
        canonicalMemoryMutation: false,
      }),
    ).toThrow(/Duplicate capability id/u);
  });
});
