import {
  infrastructureBlueprintSchema,
  validateBlueprint,
  type InfrastructureBlueprint,
} from "@stoic-iris/blueprints";

import {
  applicationFactoryBundleSchema,
  applicationSpecificationSchema,
  approvedCapabilitySelectionSchema,
  digest,
  type ApplicationFactoryBundle,
  type ApplicationSpecification,
  type ApprovedCapabilitySelection,
} from "./contracts.js";

const zeroDigest = `sha256:${"0".repeat(64)}`;

function generatedFiles(specification: ApplicationSpecification) {
  const packageJson = `${JSON.stringify(
    {
      name: `@stoic-iris-apps/${specification.applicationId}`,
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: { test: "node --test", start: "node src/index.mjs" },
    },
    null,
    2,
  )}\n`;
  const readme = `# ${specification.name}\n\nLayer 4 application generated as a proposal by IRIS.\n\nPurpose: ${specification.purpose}\n`;
  const source = `export function describeApplication() {\n  return ${JSON.stringify({ id: specification.applicationId, purpose: specification.purpose }, null, 2)};\n}\n`;
  return [
    {
      path: "package.json",
      content: packageJson,
      digest: digest(packageJson),
      purpose: "Exact tool boundary",
    },
    { path: "README.md", content: readme, digest: digest(readme), purpose: "Layer 4 identity" },
    {
      path: "src/index.mjs",
      content: source,
      digest: digest(source),
      purpose: "Governed integration entrypoint",
    },
  ];
}

function blueprint(specification: ApplicationSpecification): InfrastructureBlueprint {
  return infrastructureBlueprintSchema.parse({
    apiVersion: "iris.stoic/v1",
    id: specification.applicationId,
    name: specification.name,
    profile: specification.targetProfile,
    approvalStatus: "pending",
    networks: [{ id: `${specification.applicationId}-private`, internal: true }],
    secrets: [],
    policy: {
      allowPublicExposure: false,
      requireDigestLocks: true,
      requireNonRoot: true,
      maxHourlyCostUsd: specification.maximumHourlyCostUsd,
    },
    metadata: {
      createdBy: "IRIS Application Factory",
      createdAt: specification.createdAt,
      sourceRevision: "pending-private-repository-creation",
    },
    nodes: [
      {
        id: `${specification.applicationId}-service`,
        name: `${specification.name} Service`,
        kind: "service",
        image: { repository: `example.invalid/${specification.applicationId}`, digest: zeroDigest },
        command: ["node", "src/index.mjs"],
        environment: { NODE_ENV: specification.targetProfile },
        ports: [],
        networks: [`${specification.applicationId}-private`],
        secrets: [],
        resources: { cpuCores: 1, memoryMiB: 512, storageGiB: 0, gpuCount: 0, hourlyCostUsd: 0 },
        security: {
          runAsNonRoot: true,
          readOnlyRootFilesystem: true,
          dropAllCapabilities: true,
          noNewPrivileges: true,
        },
        provenance: { source: "IRIS original generation", license: "UNLICENSED", version: "0.0.0" },
      },
    ],
    edges: [],
  });
}

export class ApplicationFactory {
  generate(
    specificationInput: ApplicationSpecification,
    selectionInput: ApprovedCapabilitySelection,
    repositoryOwner: string,
  ): ApplicationFactoryBundle {
    const specification = applicationSpecificationSchema.parse(specificationInput);
    const selection = approvedCapabilitySelectionSchema.parse(selectionInput);
    if (selection.applicationId !== specification.applicationId)
      throw new Error("Capability selection targets a different application.");
    if (selection.specificationDigest !== digest(specification))
      throw new Error("Capability approval does not bind the exact application specification.");
    const requested = new Set(specification.requestedCapabilities);
    const selected = new Set(selection.capabilities.map(({ capabilityId }) => capabilityId));
    for (const capability of requested)
      if (!selected.has(capability))
        throw new Error(`Requested capability ${capability} is not approved.`);
    const infrastructureBlueprint = blueprint(specification);
    if (validateBlueprint(infrastructureBlueprint).length > 0)
      throw new Error("Generated infrastructure blueprint failed validation.");
    return applicationFactoryBundleSchema.parse({
      bundleId: `bundle-${specification.applicationId}`,
      applicationId: specification.applicationId,
      state: "proposal",
      executionAuthorized: false,
      repository: {
        owner: repositoryOwner,
        name: specification.applicationId,
        visibility: "private",
        createRequested: true,
        created: false,
        coreRepositoryMutationAllowed: false,
      },
      files: generatedFiles(specification),
      infrastructureBlueprint,
      verification: {
        checks: ["format", "lint", "typecheck", "test", "build", "blueprint-validate"],
        securityChecks: ["secret-scan", "dependency-audit", "non-root-runtime", "network-exposure"],
        licenseChecks: selection.capabilities.map(
          ({ capabilityId, license }) => `${capabilityId}:${license}`,
        ),
      },
      deployment: {
        disposable: true,
        requiresApproval: true,
        commands: [["docker", "compose", "up", "--detach", "--wait"]],
        rollbackCommands: [["git", "revert", "<approved-application-revision>"]],
        cleanupCommands: [["docker", "compose", "down", "--volumes", "--remove-orphans"]],
        verifyZeroCommands: [["docker", "compose", "ps", "--all", "--quiet"]],
      },
      maintenance: {
        dependencyReviewCadence: "monthly",
        securityReviewCadence: "each release and monthly",
        backupAndRestoreTestCadence: "quarterly when persistent data exists",
        monitoring: [
          "availability",
          "latency",
          "errors",
          "resource use",
          "cost",
          "security events",
        ],
        deprecationPolicy:
          "Founder-approved replacement, migration, rollback, and removal evidence required.",
      },
    });
  }
}
