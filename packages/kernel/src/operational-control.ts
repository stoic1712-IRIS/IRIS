import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const citationSchema = z.enum([
  "docs/governance/waves-0-12-canonical-closure-audit.md",
  "evidence/wave-10/sovereign-development-graduation-2026-08-05.md",
  "docs/specifications/wave-9-capability-learning-worker-foundry.md",
]);

export const operationalMissionProposalSchema = z
  .object({
    proposalId: z.string().regex(/^proposal_release-five-[a-f0-9]{12}$/),
    riskClass: z.literal("R3"),
    protectedAction: z.literal("worker-activation"),
    objective: z.string().min(1).max(5_000),
    worker: z
      .object({
        workerClass: z.literal("read-only"),
        model: z.literal("qwen3:8b"),
        provider: z.literal("ollama-loopback"),
        readPaths: z.array(citationSchema).length(3),
        writePaths: z.tuple([]),
        tools: z.tuple([]),
        mayDelegate: z.literal(false),
        maySelfApprove: z.literal(false),
        timeoutSeconds: z.literal(120),
        maximumOutputBytes: z.literal(65_536),
        maximumCostUsd: z.literal(0),
      })
      .strict(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    approvalStatement: z.string().min(1),
  })
  .strict();
export type OperationalMissionProposal = z.infer<typeof operationalMissionProposalSchema>;

export const operationalWorkerResultSchema = z
  .object({
    status: z.enum(["ready", "needs-review"]),
    summary: z.string().min(1).max(4_000),
    findings: z
      .array(
        z
          .object({
            claim: z.string().min(1).max(2_000),
            citation: citationSchema,
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export type OperationalWorkerResult = z.infer<typeof operationalWorkerResultSchema>;

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function createOperationalMissionProposal(
  objective: string,
  now = new Date(),
): OperationalMissionProposal {
  const base = {
    riskClass: "R3" as const,
    protectedAction: "worker-activation" as const,
    objective: z.string().trim().min(1).max(5_000).parse(objective),
    worker: {
      workerClass: "read-only" as const,
      model: "qwen3:8b" as const,
      provider: "ollama-loopback" as const,
      readPaths: citationSchema.options,
      writePaths: [] as const,
      tools: [] as const,
      mayDelegate: false as const,
      maySelfApprove: false as const,
      timeoutSeconds: 120 as const,
      maximumOutputBytes: 65_536 as const,
      maximumCostUsd: 0 as const,
    },
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60_000).toISOString(),
  };
  const proposalDigest = digest(base);
  const proposalId = `proposal_release-five-${proposalDigest.slice(7, 19)}`;
  const approvalStatement = `I approve worker activation ${proposalId} at ${proposalDigest} for one disposable local read-only qwen3:8b execution exactly as proposed.`;
  return operationalMissionProposalSchema.parse({
    proposalId,
    ...base,
    digest: proposalDigest,
    approvalStatement,
  });
}

export function bindApprovalCode(
  secret: string,
  proposal: OperationalMissionProposal,
  code: string,
): string {
  return createHmac("sha256", secret).update(`${proposal.digest}\n${code}`).digest("hex");
}

export function verifyOperationalApproval(input: {
  proposal: OperationalMissionProposal;
  statement: string;
  code: string;
  expectedCodeBinding: string;
  bindingSecret: string;
  now?: Date;
}): boolean {
  const proposal = operationalMissionProposalSchema.parse(input.proposal);
  const now = input.now ?? new Date();
  if (
    input.statement !== proposal.approvalStatement ||
    !/^\d{8}$/u.test(input.code) ||
    now.getTime() >= Date.parse(proposal.expiresAt)
  )
    return false;
  const actual = bindApprovalCode(input.bindingSecret, proposal, input.code);
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(input.expectedCodeBinding, "hex"));
}
