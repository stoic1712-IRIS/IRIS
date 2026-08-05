import {
  generateWorkerSpecification,
  workerSpecificationDigest,
  type WorkerSpecification,
} from "@stoic-iris/workers";
import { z } from "zod";

import {
  capabilityDecisionSchema,
  founderPatternApprovalSchema,
  type CapabilityDecision,
  type FounderPatternApproval,
} from "./contracts.js";

export const foundryProposalSchema = z
  .object({
    proposalId: z.string().regex(/^proposal_[a-z0-9][a-z0-9-]{2,99}$/),
    status: z.literal("requires-founder-approval"),
    maySelfApprove: z.literal(false),
    maySelfActivate: z.literal(false),
    originalImplementation: z.literal(true),
    copiedSourceCode: z.literal(false),
    externalRuntimeDependencies: z.tuple([]),
    worker: z.custom<WorkerSpecification>(),
    workerDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    artifacts: z
      .object({
        instructions: z.array(z.string()).min(1),
        permissionPolicy: z.array(z.string()).min(1),
        toolBindings: z.array(z.string()),
        containerDefinition: z.array(z.string()).min(1),
        testTemplates: z.array(z.string()).min(1),
        documentation: z.string().min(1),
        registryEntry: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type FoundryProposal = z.infer<typeof foundryProposalSchema>;

export class WorkerFoundry {
  generate(input: {
    decision: CapabilityDecision;
    approval: FounderPatternApproval;
    worker: Omit<WorkerSpecification, "permissions"> & {
      requestedPaths: string[];
      requestedTools: string[];
    };
  }): FoundryProposal {
    const decision = capabilityDecisionSchema.parse(input.decision);
    const approval = founderPatternApprovalSchema.parse(input.approval);
    if (decision.recommendation !== "build")
      throw new Error("Only an approved build recommendation can enter the Worker Foundry.");
    if (approval.reviewDigest !== decision.reviewDigest)
      throw new Error("Founder approval does not match the reviewed capability decision.");

    const worker = generateWorkerSpecification({
      ...input.worker,
      requestedPaths: input.worker.requestedPaths,
      requestedTools: input.worker.requestedTools,
      codingWorkerGatePassed: false,
    });
    if (worker.workerClass !== "read-only")
      throw new Error("Wave 9 generation is limited to read-only workers.");

    return foundryProposalSchema.parse({
      proposalId: `proposal_${worker.workerId.slice("worker_".length)}`,
      status: "requires-founder-approval",
      maySelfApprove: false,
      maySelfActivate: false,
      originalImplementation: true,
      copiedSourceCode: false,
      externalRuntimeDependencies: [],
      worker,
      workerDigest: workerSpecificationDigest(worker),
      artifacts: {
        instructions: [...worker.reasoning.instructions],
        permissionPolicy: [
          `Read only: ${worker.permissions.readPaths.join(", ")}`,
          "No delegation, permission expansion, self-approval, or self-activation.",
        ],
        toolBindings: [...worker.permissions.tools],
        containerDefinition: ["network=none", "readOnly=true", "capDrop=ALL", "user=non-root"],
        testTemplates: [
          "reject mismatched approval",
          "operate without external runtime",
          "verify termination and zero resources",
        ],
        documentation: `${worker.identity.name}: ${worker.identity.role}`,
        registryEntry: `${worker.workerId}; IRIS-native; activation pending Founder approval`,
      },
    });
  }

  activate(_proposal: FoundryProposal): never {
    void _proposal;
    throw new Error("Generated workers cannot approve or activate themselves.");
  }
}
