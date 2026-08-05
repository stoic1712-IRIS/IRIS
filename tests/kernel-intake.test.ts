import { describe, expect, it } from "vitest";

import { classifyObjective, objectiveInputSchema } from "../packages/kernel/src/index.js";

const baseObjective = {
  objectiveId: "objective_01936f3a-8b5c-7def-8abc-0123456789ab",
  submittedAt: "2026-08-04T19:00:00-06:00",
  summary: "Inspect repository status",
  requestedOutcome: "Return a read-only status report.",
  mode: "read" as const,
  externalEffects: false,
  destructive: false,
  usesSecrets: false,
  createsCost: false,
};

describe("Kernel objective intake", () => {
  it("keeps a read-only objective read-only", () => {
    expect(classifyObjective(baseObjective)).toMatchObject({
      riskClass: "R0",
      authorizationRequirement: "existing-read-authority",
    });
  });

  it("requires typed approval when any external effect is present", () => {
    expect(classifyObjective({ ...baseObjective, externalEffects: true })).toMatchObject({
      riskClass: "R3",
      authorizationRequirement: "typed-protected-approval",
    });
  });

  it("denies prohibited objectives", () => {
    expect(classifyObjective({ ...baseObjective, mode: "prohibited" })).toMatchObject({
      riskClass: "R4",
      authorizationRequirement: "deny",
    });
  });

  it("rejects undeclared intake fields", () => {
    expect(
      objectiveInputSchema.safeParse({ ...baseObjective, silentAuthority: true }).success,
    ).toBe(false);
  });
});
