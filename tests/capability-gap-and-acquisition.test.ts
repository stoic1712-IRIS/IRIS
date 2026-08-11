import { describe, expect, it } from "vitest";

import {
  classifyCapabilityGap,
  prepareCapabilityAcquisition,
  verifyCapabilityAcquisitionApproval,
} from "../packages/capabilities/src/index.js";

const baseEvidence = {
  capability: "desktop.window-screenshot",
  registered: true,
  providerInstalled: true,
  providerRunning: true,
  providerCompatible: true,
  authorized: true,
  credentialReferenceAvailable: true,
  sourceReachable: true,
  hardwareSufficient: true,
  supportedAfterResearch: true,
  protectedEffectRequired: false,
  evidence: ["Local preflight completed at 2026-08-08T12:00:00.000Z."],
};

describe("IRIS capability-gap classification", () => {
  it.each([
    ["capability-not-registered", { registered: false }],
    ["provider-not-installed", { providerInstalled: false }],
    ["provider-not-running", { providerRunning: false }],
    ["provider-version-incompatible", { providerCompatible: false }],
    ["authorization-not-granted", { authorized: false }],
    ["credential-reference-required", { credentialReferenceAvailable: false }],
    ["network-or-source-unavailable", { sourceReachable: false }],
    ["hardware-insufficient", { hardwareSufficient: false }],
    ["unsupported-after-research", { supportedAfterResearch: false }],
    ["protected-effect-required", { protectedEffectRequired: true }],
  ] as const)("classifies %s with evidence", (expected, override) => {
    expect(classifyCapabilityGap({ ...baseEvidence, ...override }).type).toBe(expected);
  });

  it("rejects a vague gap without evidence", () => {
    expect(() =>
      classifyCapabilityGap({ ...baseEvidence, registered: false, evidence: [] }),
    ).toThrow();
  });
});

describe("IRIS capability acquisition", () => {
  const input = {
    proposalId: "acquisition_desktop-screenshot-0001",
    capability: "desktop.window-screenshot",
    gapType: "provider-not-installed" as const,
    source: {
      url: "https://github.com/example/provider/releases/tag/v1.2.3",
      version: "1.2.3",
      sha256: `sha256:${"a".repeat(64)}`,
      license: "MIT",
      primary: true,
    },
    cost: { amountUsd: 0, recurrence: "none" as const },
    permissions: ["selected-window-capture"],
    dataExposure: ["selected-window-pixels-local-only"],
    installCommands: [["pnpm", "add", "provider@1.2.3", "--offline"]],
    verificationCommands: [["pnpm", "test"]],
    rollbackCommands: [["pnpm", "remove", "provider", "--offline"]],
    removalCommands: [["pnpm", "remove", "provider", "--offline"]],
    registryUpdates: ["desktop.window-screenshot -> provider@1.2.3"],
    objectiveDigest: `sha256:${"b".repeat(64)}`,
    contractDigest: `sha256:${"c".repeat(64)}`,
    canonicalRevision: "d".repeat(40),
    createdAt: "2026-08-08T12:00:00.000Z",
  };

  it("binds the complete acquisition plan to an exact approval statement", () => {
    const prepared = prepareCapabilityAcquisition(input);
    expect(prepared.digest).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(prepared.requiredApprovalStatement).toBe(
      `I approve capability acquisition ${input.proposalId} at ${prepared.digest} exactly as proposed.`,
    );
    expect(
      verifyCapabilityAcquisitionApproval(prepared, prepared.requiredApprovalStatement, {
        lifecycle: "active",
        contractDigest: input.contractDigest,
        canonicalRevision: input.canonicalRevision,
      }),
    ).toBe(true);
  });

  it("rejects changed, consumed, replaced, revoked, drifted, mutable, paid, or incomplete plans", () => {
    const prepared = prepareCapabilityAcquisition(input);
    expect(
      verifyCapabilityAcquisitionApproval(
        prepared,
        prepared.requiredApprovalStatement,
        undefined as never,
      ),
    ).toBe(false);
    expect(
      verifyCapabilityAcquisitionApproval(
        prepared,
        prepared.requiredApprovalStatement.replace("exactly", "generally"),
        {
          lifecycle: "active",
          contractDigest: input.contractDigest,
          canonicalRevision: input.canonicalRevision,
        },
      ),
    ).toBe(false);
    for (const lifecycle of ["consumed", "replaced", "revoked"] as const)
      expect(
        verifyCapabilityAcquisitionApproval(prepared, prepared.requiredApprovalStatement, {
          lifecycle,
          contractDigest: input.contractDigest,
          canonicalRevision: input.canonicalRevision,
        }),
      ).toBe(false);
    expect(
      verifyCapabilityAcquisitionApproval(prepared, prepared.requiredApprovalStatement, {
        lifecycle: "active",
        contractDigest: `sha256:${"e".repeat(64)}`,
        canonicalRevision: input.canonicalRevision,
      }),
    ).toBe(false);
    expect(
      verifyCapabilityAcquisitionApproval(prepared, prepared.requiredApprovalStatement, {
        lifecycle: "active",
        contractDigest: input.contractDigest,
        canonicalRevision: "f".repeat(40),
      }),
    ).toBe(false);
    expect(() =>
      prepareCapabilityAcquisition({
        ...input,
        source: { ...input.source, version: "latest" },
      }),
    ).toThrow();
    expect(() =>
      prepareCapabilityAcquisition({
        ...input,
        cost: { amountUsd: 1, recurrence: "one-time" },
      }),
    ).toThrow("CAPABILITY_ACQUISITION_SPENDING_PROTECTED");
  });
});
