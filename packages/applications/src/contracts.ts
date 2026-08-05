import { createHash } from "node:crypto";

import { infrastructureBlueprintSchema } from "@stoic-iris/blueprints";
import { z } from "zod";

const identifier = z.string().regex(/^[a-z][a-z0-9-]{2,62}$/);
const sha256 = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const safePath = z
  .string()
  .min(1)
  .max(300)
  .refine((value) => !value.startsWith("/") && !value.split("/").includes(".."));

export const applicationSpecificationSchema = z
  .object({
    applicationId: identifier,
    name: z.string().min(1).max(160),
    classification: z.literal("layer-4"),
    separateRepository: z.literal(true),
    owner: z.literal("Founder"),
    purpose: z.string().min(1).max(2_000),
    functionalRequirements: z.array(z.string().min(1).max(500)).min(1),
    requestedCapabilities: z.array(identifier).min(1),
    dataClassification: z.enum(["public", "internal", "confidential"]),
    targetProfile: z.enum(["development", "test", "staging", "production"]),
    maximumHourlyCostUsd: z.number().nonnegative(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type ApplicationSpecification = z.infer<typeof applicationSpecificationSchema>;

export const approvedCapabilitySelectionSchema = z
  .object({
    selectionId: identifier,
    applicationId: identifier,
    specificationDigest: sha256,
    actor: z.literal("Founder"),
    decision: z.literal("approved"),
    approvedAt: z.iso.datetime({ offset: true }),
    capabilities: z
      .array(
        z
          .object({
            capabilityId: identifier,
            source: z.enum(["iris-core", "iris-owned-adapter", "original-layer-4"]),
            version: z.string().min(1).max(100),
            license: z.string().min(1).max(100),
            licenseApproved: z.literal(true),
            securityApproved: z.literal(true),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type ApprovedCapabilitySelection = z.infer<typeof approvedCapabilitySelectionSchema>;

export const generatedFileSchema = z
  .object({ path: safePath, content: z.string(), digest: sha256, purpose: z.string().min(1) })
  .strict();

export const applicationFactoryBundleSchema = z
  .object({
    bundleId: identifier,
    applicationId: identifier,
    state: z.literal("proposal"),
    executionAuthorized: z.literal(false),
    repository: z
      .object({
        owner: z.string().min(1),
        name: identifier,
        visibility: z.literal("private"),
        createRequested: z.literal(true),
        created: z.literal(false),
        coreRepositoryMutationAllowed: z.literal(false),
      })
      .strict(),
    files: z.array(generatedFileSchema).min(2),
    infrastructureBlueprint: infrastructureBlueprintSchema,
    verification: z
      .object({
        checks: z.array(z.string().min(1)).min(1),
        securityChecks: z.array(z.string().min(1)).min(1),
        licenseChecks: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    deployment: z
      .object({
        disposable: z.literal(true),
        requiresApproval: z.literal(true),
        commands: z.array(z.array(z.string().min(1)).min(1)),
        rollbackCommands: z.array(z.array(z.string().min(1)).min(1)),
        cleanupCommands: z.array(z.array(z.string().min(1)).min(1)),
        verifyZeroCommands: z.array(z.array(z.string().min(1)).min(1)),
      })
      .strict(),
    maintenance: z
      .object({
        dependencyReviewCadence: z.string().min(1),
        securityReviewCadence: z.string().min(1),
        backupAndRestoreTestCadence: z.string().min(1),
        monitoring: z.array(z.string().min(1)).min(1),
        deprecationPolicy: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type ApplicationFactoryBundle = z.infer<typeof applicationFactoryBundleSchema>;

export const researchIntakeSchema = z
  .object({
    intakeId: identifier,
    subject: z.string().min(1).max(300),
    source: z.url(),
    sourceRevision: z.string().min(7).max(200),
    license: z.string().min(1).max(100),
    observedAt: z.iso.datetime({ offset: true }),
    claims: z.array(z.string().min(1).max(1_000)).min(1),
  })
  .strict();
export type ResearchIntake = z.infer<typeof researchIntakeSchema>;

export const benchmarkResultSchema = z
  .object({
    benchmarkId: identifier,
    subject: identifier,
    metric: z.string().min(1),
    value: z.number(),
    unit: z.string().min(1),
    environment: z.string().min(1),
    evidenceDigest: sha256,
  })
  .strict();
export type BenchmarkResult = z.infer<typeof benchmarkResultSchema>;

export const evolutionProposalSchema = z
  .object({
    proposalId: identifier,
    category: z.enum([
      "architecture-comparison",
      "upgrade",
      "deprecation",
      "native-replacement",
      "roadmap-reprioritization",
      "self-improvement",
    ]),
    subject: z.string().min(1),
    evidenceDigests: z.array(sha256).min(1),
    recommendation: z.string().min(1),
    risks: z.array(z.string()),
    rollback: z.string().min(1),
    state: z.literal("pending-founder-approval"),
    executionAuthorized: z.literal(false),
  })
  .strict();
export type EvolutionProposal = z.infer<typeof evolutionProposalSchema>;

export function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
