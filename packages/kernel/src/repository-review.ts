import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const repositorySchema = z.enum([
  "stoic1712-IRIS/IRIS",
  "stoic1712-IRIS/iris-founder-command-center",
]);
export const repositoryReviewProposalSchema = z.strictObject({
  proposalId: z.string().regex(/^proposal_release-six-[a-f0-9]{12}$/),
  repository: repositorySchema,
  baseRevision: z.string().regex(/^[a-f0-9]{40}$/),
  headRevision: z.string().regex(/^[a-f0-9]{40}$/),
  mergeBaseRevision: z.string().regex(/^[a-f0-9]{40}$/),
  diffDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  changedFiles: z.array(z.string().min(1).max(300)).max(100),
  model: z.literal("qwen3:8b"),
  maximumInputBytes: z.literal(1_048_576),
  maximumOutputBytes: z.literal(65_536),
  timeoutSeconds: z.literal(120),
  writeAuthority: z.literal(false),
  githubAuthority: z.literal(false),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  approvalStatement: z.string().min(1),
});
export type RepositoryReviewProposal = z.infer<typeof repositoryReviewProposalSchema>;
export const repositoryReviewResultSchema = z.strictObject({
  verdict: z.enum(["pass", "needs-review", "block"]),
  summary: z.string().min(1).max(4_000),
  findings: z
    .array(
      z.strictObject({
        severity: z.enum(["low", "medium", "high", "critical"]),
        confidence: z.number().min(0).max(1),
        claim: z.string().min(1).max(2_000),
        file: z.string().min(1).max(300),
        line: z.number().int().positive().nullable(),
        evidence: z.string().min(1).max(2_000),
        remediation: z.string().min(1).max(2_000),
      }),
    )
    .max(20),
});
export type RepositoryReviewResult = z.infer<typeof repositoryReviewResultSchema>;

export function validateRepositoryReviewResult(
  value: unknown,
  changedFiles: readonly string[],
  citedLines: Readonly<Record<string, readonly number[]>>,
): RepositoryReviewResult {
  const result = repositoryReviewResultSchema.parse(value);
  const allowedFiles = new Set(changedFiles);
  const seen = new Set<string>();
  for (const finding of result.findings) {
    if (!allowedFiles.has(finding.file)) throw new Error("CITATION_FILE_DENIED");
    if (finding.line !== null && !new Set(citedLines[finding.file] ?? []).has(finding.line))
      throw new Error("CITATION_LINE_DENIED");
    const fingerprint = `${finding.file}\n${String(finding.line)}\n${finding.claim.trim().toLowerCase()}`;
    if (seen.has(fingerprint)) throw new Error("DUPLICATE_FINDING");
    seen.add(fingerprint);
  }
  return result;
}
export function createRepositoryReviewProposal(
  input: Omit<
    RepositoryReviewProposal,
    "proposalId" | "digest" | "approvalStatement" | "createdAt" | "expiresAt"
  >,
  now = new Date(),
): RepositoryReviewProposal {
  const base = {
    ...input,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 120_000).toISOString(),
  };
  const digest = `sha256:${createHash("sha256").update(JSON.stringify(base)).digest("hex")}`;
  const proposalId = `proposal_release-six-${digest.slice(7, 19)}`;
  return repositoryReviewProposalSchema.parse({
    ...base,
    proposalId,
    digest,
    approvalStatement: `I approve repository review ${proposalId} at ${digest} for one disposable local read-only qwen3:8b execution exactly as proposed.`,
  });
}

export function bindRepositoryReviewCode(
  secret: string,
  proposal: RepositoryReviewProposal,
  code: string,
): string {
  return createHmac("sha256", secret).update(`${proposal.digest}\n${code}`).digest("hex");
}

export function verifyRepositoryReviewApproval(input: {
  proposal: RepositoryReviewProposal;
  statement: string;
  code: string;
  expectedCodeBinding: string;
  bindingSecret: string;
  now?: Date;
}): boolean {
  const proposal = repositoryReviewProposalSchema.parse(input.proposal);
  const now = input.now ?? new Date();
  if (
    input.statement !== proposal.approvalStatement ||
    !/^\d{8}$/u.test(input.code) ||
    now.getTime() >= Date.parse(proposal.expiresAt)
  )
    return false;
  const actual = bindRepositoryReviewCode(input.bindingSecret, proposal, input.code);
  return (
    /^[a-f0-9]{64}$/u.test(input.expectedCodeBinding) &&
    timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(input.expectedCodeBinding, "hex"))
  );
}
