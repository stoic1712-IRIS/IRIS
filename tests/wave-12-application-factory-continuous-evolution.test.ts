import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ApplicationFactory,
  ContinuousEvolutionEngine,
  applicationSpecificationSchema,
  digest,
  type ApprovedCapabilitySelection,
  type ApplicationSpecification,
} from "../packages/applications/src/index.js";
import {
  infrastructureBlueprintSchema,
  validateBlueprint,
} from "../packages/blueprints/src/index.js";

const specification: ApplicationSpecification = applicationSpecificationSchema.parse({
  applicationId: "fictional-field-notes",
  name: "Fictional Field Notes",
  classification: "layer-4",
  separateRepository: true,
  owner: "Founder",
  purpose: "Prove a separate disposable Layer 4 application factory lifecycle.",
  functionalRequirements: ["Create and list fictional notes", "Operate without external services"],
  requestedCapabilities: ["structured-storage", "health-reporting"],
  dataClassification: "internal",
  targetProfile: "test",
  maximumHourlyCostUsd: 0,
  createdAt: "2026-08-05T12:15:00-06:00",
});

const selection: ApprovedCapabilitySelection = {
  selectionId: "field-notes-capabilities",
  applicationId: specification.applicationId,
  specificationDigest: digest(specification),
  actor: "Founder",
  decision: "approved",
  approvedAt: "2026-08-05T12:16:00-06:00",
  capabilities: [
    {
      capabilityId: "structured-storage",
      source: "iris-core",
      version: "1.0.0",
      license: "UNLICENSED",
      licenseApproved: true,
      securityApproved: true,
    },
    {
      capabilityId: "health-reporting",
      source: "original-layer-4",
      version: "1.0.0",
      license: "UNLICENSED",
      licenseApproved: true,
      securityApproved: true,
    },
  ],
};

describe("Wave 12 Application Factory", () => {
  it("requires an exact Founder-approved capability selection", () => {
    const altered = { ...selection, specificationDigest: `sha256:${"1".repeat(64)}` };
    expect(() =>
      new ApplicationFactory().generate(specification, altered, "stoic1712-IRIS"),
    ).toThrow(/does not bind/);
  });

  it("keeps Layer 4 applications in a proposed private repository outside IRIS Core", () => {
    const bundle = new ApplicationFactory().generate(specification, selection, "stoic1712-IRIS");
    expect(bundle).toMatchObject({
      state: "proposal",
      executionAuthorized: false,
      repository: {
        visibility: "private",
        created: false,
        coreRepositoryMutationAllowed: false,
      },
    });
    expect(bundle.files.map(({ path }) => path)).toEqual([
      "package.json",
      "README.md",
      "src/index.mjs",
    ]);
  });

  it("generates a valid locked private-network infrastructure blueprint", () => {
    const bundle = new ApplicationFactory().generate(specification, selection, "stoic1712-IRIS");
    const blueprint = infrastructureBlueprintSchema.parse(bundle.infrastructureBlueprint);
    expect(validateBlueprint(blueprint)).toEqual([]);
    expect(blueprint.networks).toEqual([{ id: "fictional-field-notes-private", internal: true }]);
    expect(blueprint.nodes[0]?.ports).toEqual([]);
  });

  it("provides verification, security, license, disposable deployment, rollback, cleanup, zero-resource, maintenance, and monitoring plans", () => {
    const bundle = new ApplicationFactory().generate(specification, selection, "stoic1712-IRIS");
    expect(bundle.verification.checks).toContain("blueprint-validate");
    expect(bundle.verification.securityChecks).toContain("secret-scan");
    expect(bundle.verification.licenseChecks).toHaveLength(2);
    expect(bundle.deployment).toMatchObject({ disposable: true, requiresApproval: true });
    expect(bundle.deployment.rollbackCommands).toHaveLength(1);
    expect(bundle.deployment.cleanupCommands).toHaveLength(1);
    expect(bundle.deployment.verifyZeroCommands).toHaveLength(1);
    expect(bundle.maintenance.monitoring).toContain("cost");
  });

  it("materializes and removes the generated application in a disposable local workspace", async () => {
    const bundle = new ApplicationFactory().generate(specification, selection, "stoic1712-IRIS");
    const workspace = await mkdtemp(join(tmpdir(), "iris-wave12-"));
    try {
      for (const file of bundle.files) {
        const target = join(workspace, file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, "utf8");
        expect(digest(await readFile(target, "utf8"))).toBe(file.digest);
      }
      expect(JSON.parse(await readFile(join(workspace, "package.json"), "utf8"))).toMatchObject({
        private: true,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
    await expect(readFile(join(workspace, "package.json"), "utf8")).rejects.toThrow();
  });
});

describe("Wave 12 Continuous Evolution", () => {
  it.each([
    "architecture-comparison",
    "upgrade",
    "deprecation",
    "native-replacement",
    "roadmap-reprioritization",
    "self-improvement",
  ] as const)("creates a non-executable %s proposal", (category) => {
    const proposal = new ContinuousEvolutionEngine().compare({
      proposalId: `${category}-proposal`,
      category,
      subject: "fictional-runtime",
      research: [
        {
          intakeId: "fictional-runtime-research",
          subject: "Fictional runtime",
          source: "https://example.invalid/fictional-runtime",
          sourceRevision: "revision-0001",
          license: "MIT",
          observedAt: "2026-08-05T12:20:00-06:00",
          claims: ["Synthetic claim for deterministic acceptance testing."],
        },
      ],
      benchmarks: [
        {
          benchmarkId: "fictional-runtime-benchmark",
          subject: "fictional-runtime",
          metric: "latency",
          value: 10,
          unit: "milliseconds",
          environment: "synthetic-test",
          evidenceDigest: `sha256:${"2".repeat(64)}`,
        },
      ],
      recommendation: "Founder should review this fictional proposal.",
      risks: ["Synthetic evidence cannot justify production adoption."],
      rollback: "Reject the proposal and preserve the current architecture.",
    });
    expect(proposal).toMatchObject({
      category,
      state: "pending-founder-approval",
      executionAuthorized: false,
    });
    expect(proposal.evidenceDigests).toHaveLength(2);
  });

  it("rejects unsupported proposals with no research or benchmark evidence", () => {
    expect(() =>
      new ContinuousEvolutionEngine().compare({
        proposalId: "empty-evolution-proposal",
        category: "self-improvement",
        subject: "IRIS",
        research: [],
        benchmarks: [],
        recommendation: "Change silently.",
        risks: [],
        rollback: "None.",
      }),
    ).toThrow(/require research or benchmark evidence/);
  });
});
