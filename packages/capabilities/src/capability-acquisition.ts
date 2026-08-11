import { z } from "zod";

import { capabilityGapTypeSchema } from "./capability-gap.js";
import { digest as sha256Digest } from "./contracts.js";

const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const commandSchema = z.array(z.string().min(1).max(500)).min(1).max(30);

export const capabilityAcquisitionProposalSchema = z
  .object({
    proposalId: z.string().regex(/^acquisition_[a-z0-9-]{8,100}$/u),
    capability: z.string().regex(/^[a-z][a-z0-9.-]{2,199}$/u),
    gapType: capabilityGapTypeSchema,
    source: z
      .object({
        url: z.url().refine((value) => new URL(value).protocol === "https:"),
        version: z
          .string()
          .min(1)
          .max(100)
          .refine((value) => !/^(?:latest|main|master|head)$/iu.test(value)),
        sha256: digestSchema,
        license: z.string().min(1).max(100),
        primary: z.literal(true),
      })
      .strict(),
    cost: z
      .object({
        amountUsd: z.number().nonnegative(),
        recurrence: z.enum(["none", "one-time", "monthly", "annual"]),
      })
      .strict(),
    permissions: z.array(z.string().min(1).max(500)).min(1).max(50),
    dataExposure: z.array(z.string().min(1).max(500)).min(1).max(50),
    installCommands: z.array(commandSchema).min(1).max(20),
    verificationCommands: z.array(commandSchema).min(1).max(20),
    rollbackCommands: z.array(commandSchema).min(1).max(20),
    removalCommands: z.array(commandSchema).min(1).max(20),
    registryUpdates: z.array(z.string().min(1).max(1_000)).min(1).max(50),
    objectiveDigest: digestSchema,
    contractDigest: digestSchema,
    canonicalRevision: z.string().regex(/^[a-f0-9]{40,64}$/u),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type CapabilityAcquisitionProposal = z.infer<typeof capabilityAcquisitionProposalSchema>;

export const preparedCapabilityAcquisitionSchema = capabilityAcquisitionProposalSchema.safeExtend({
  digest: digestSchema,
  requiredApprovalStatement: z.string().min(1).max(500),
});
export type PreparedCapabilityAcquisition = z.infer<typeof preparedCapabilityAcquisitionSchema>;

export const capabilityAcquisitionApprovalLifecycleSchema = z
  .object({
    lifecycle: z.enum(["active", "consumed", "replaced", "revoked"]),
    contractDigest: digestSchema,
    canonicalRevision: z.string().regex(/^[a-f0-9]{40,64}$/u),
  })
  .strict();
export type CapabilityAcquisitionApprovalLifecycle = z.infer<
  typeof capabilityAcquisitionApprovalLifecycleSchema
>;

export function prepareCapabilityAcquisition(input: unknown): PreparedCapabilityAcquisition {
  const proposal = capabilityAcquisitionProposalSchema.parse(input);
  if (proposal.cost.amountUsd > 0 || proposal.cost.recurrence !== "none")
    throw new Error("CAPABILITY_ACQUISITION_SPENDING_PROTECTED");
  const digest = sha256Digest(proposal);
  return preparedCapabilityAcquisitionSchema.parse({
    ...proposal,
    digest,
    requiredApprovalStatement: `I approve capability acquisition ${proposal.proposalId} at ${digest} exactly as proposed.`,
  });
}

export function verifyCapabilityAcquisitionApproval(
  input: unknown,
  statement: string,
  lifecycleInput: CapabilityAcquisitionApprovalLifecycle,
): boolean {
  const prepared = preparedCapabilityAcquisitionSchema.parse(input);
  const { digest, requiredApprovalStatement, ...proposal } = prepared;
  const parsedLifecycle = capabilityAcquisitionApprovalLifecycleSchema.safeParse(lifecycleInput);
  if (!parsedLifecycle.success) return false;
  const lifecycle = parsedLifecycle.data;
  return (
    digest === sha256Digest(capabilityAcquisitionProposalSchema.parse(proposal)) &&
    statement === requiredApprovalStatement &&
    lifecycle.lifecycle === "active" &&
    lifecycle.contractDigest === prepared.contractDigest &&
    lifecycle.canonicalRevision === prepared.canonicalRevision
  );
}
