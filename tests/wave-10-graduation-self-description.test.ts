import { describe, expect, it } from "vitest";

import { getSovereignDevelopmentSelfDescription } from "../packages/development/src/index.js";

describe("Wave 10 graduation self-description", () => {
  it("returns the exact immutable capability contract", () => {
    const description = getSovereignDevelopmentSelfDescription();
    expect(description.graduationEvidenceComplete).toBe(false);
    expect(description.capabilities).toEqual([
      "exact-bounded-proposal",
      "typed-founder-approval",
      "disposable-git-workspace",
      "allowed-path-enforcement",
      "governed-command-execution",
      "multi-file-editing",
      "tests-and-builds",
      "independent-verification",
      "repair-and-reapproval",
      "private-checkpoint",
      "remote-equality-verification",
      "history-preserving-rollback",
      "workspace-cleanup",
      "paid-resource-termination",
      "provider-authoritative-zero-verification",
    ]);
    expect(Object.isFrozen(description)).toBe(true);
    expect(Object.isFrozen(description.capabilities)).toBe(true);
  });

  it("returns distinct object and array identities", () => {
    const first = getSovereignDevelopmentSelfDescription();
    const second = getSovereignDevelopmentSelfDescription();
    expect(first).not.toBe(second);
    expect(first.capabilities).not.toBe(second.capabilities);
  });
});
