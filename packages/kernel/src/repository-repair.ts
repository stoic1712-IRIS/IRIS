import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const repairRepositorySchema = z.enum([
  "stoic1712-IRIS/IRIS",
  "stoic1712-IRIS/iris-founder-command-center",
]);
const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/);
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const safePathSchema = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9._/-]+$/u)
  .refine(
    (path) =>
      !path.startsWith("/") &&
      !path.includes("\\") &&
      !path.split("/").some((part) => part === "" || part === "." || part === ".."),
    "unsafe repository path",
  );
export const repairVerificationCommandSchema = z.enum([
  "format-check",
  "zero-warning-lint",
  "strict-typecheck",
  "unit-and-integration-tests",
  "production-build",
  "dependency-integrity-check",
  "secret-scan",
  "bundle-scan",
  "repository-diagnostics",
]);
export const repositoryRepairBootstrapCommand = "pnpm build" as const;
export const repositoryRepairApprovalWindowMs = 10 * 60_000;

export const repositoryRepairProposalSchema = z.strictObject({
  proposalId: z.string().regex(/^proposal_release-seven-[a-f0-9]{12}$/),
  repository: repairRepositorySchema,
  baseRevision: revisionSchema,
  expectedRemoteRevision: revisionSchema,
  findingDigest: digestSchema,
  defectStatement: z.string().min(10).max(4_000),
  editableFiles: z.array(safePathSchema).min(1).max(20),
  contextFiles: z.array(safePathSchema).max(40),
  verificationCommands: z.array(repairVerificationCommandSchema).min(1).max(9),
  model: z.literal("qwen3:8b"),
  modelEndpoint: z.literal("http://127.0.0.1:11434"),
  maximumInputBytes: z.literal(1_048_576),
  maximumCandidateBytes: z.literal(524_288),
  maximumModelOutputBytes: z.literal(65_536),
  maximumChangedLines: z.literal(2_000),
  maximumRuntimeSeconds: z.literal(600),
  maximumRetentionSeconds: z.literal(1_800),
  maximumCostUsd: z.literal(0),
  canonicalWriteAuthority: z.literal(false),
  candidateWriteAuthority: z.literal(true),
  githubAuthority: z.literal(false),
  networkAuthority: z.literal(false),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  digest: digestSchema,
  approvalStatement: z.string().min(1),
});
export type RepositoryRepairProposal = z.infer<typeof repositoryRepairProposalSchema>;

export const repositoryRepairCandidateSchema = z.strictObject({
  summary: z.string().min(1).max(4_000),
  files: z
    .array(
      z.strictObject({
        path: safePathSchema,
        content: z.string().max(524_288),
        rationale: z.string().min(1).max(2_000),
        expectedVerificationImpact: z.string().min(1).max(2_000),
      }),
    )
    .min(1)
    .max(20),
});
export type RepositoryRepairCandidate = z.infer<typeof repositoryRepairCandidateSchema>;

const verificationResultSchema = z.strictObject({
  command: repairVerificationCommandSchema,
  state: z.enum(["passed", "failed", "skipped"]),
  exitCode: z.number().int().nullable(),
  durationMs: z.number().int().nonnegative(),
  output: z.string().max(8_192),
});
export const repositoryRepairResultSchema = z.strictObject({
  verdict: z.enum(["verified", "needs-repair", "failed"]),
  summary: z.string().min(1).max(4_000),
  repository: repairRepositorySchema,
  baseRevision: revisionSchema,
  candidateId: z.string().regex(/^candidate_release-seven-[a-f0-9]{12}$/),
  diffDigest: digestSchema,
  changedFiles: z
    .array(
      z.strictObject({
        path: safePathSchema,
        beforeDigest: digestSchema,
        afterDigest: digestSchema,
      }),
    )
    .min(1)
    .max(20),
  diff: z.string().max(524_288),
  verification: z.array(verificationResultSchema).max(9),
  canonicalRepositoryChanged: z.literal(false),
  githubChanged: z.literal(false),
  cleanupState: z.enum(["retained-until-expiry", "completed"]),
  expiresAt: z.iso.datetime(),
});
export type RepositoryRepairResult = z.infer<typeof repositoryRepairResultSchema>;

export function formatRepositoryRepairModelDenial(status: number, responseBytes: number): string {
  const safeStatus = z.number().int().min(100).max(599).parse(status);
  const safeBytes = z.number().int().nonnegative().parse(responseBytes);
  return `MODEL_OUTPUT_DENIED status=${String(safeStatus)} bytes=${String(safeBytes)}`;
}

export function assertRepositoryRepairCheckoutContent(
  checkoutContent: string,
  canonicalContent: string,
): void {
  if (
    checkoutContent !== canonicalContent &&
    checkoutContent.replaceAll("\r\n", "\n") !== canonicalContent
  )
    throw new Error("CANDIDATE_DRIFT");
}

export function createRepositoryRepairModelSchema(
  proposalInput: RepositoryRepairProposal,
): Record<string, unknown> {
  repositoryRepairProposalSchema.parse(proposalInput);
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "files"],
    properties: {
      summary: { type: "string" },
      files: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "content", "rationale", "expectedVerificationImpact"],
          properties: {
            path: { type: "string" },
            content: { type: "string" },
            rationale: { type: "string" },
            expectedVerificationImpact: { type: "string" },
          },
        },
      },
    },
  };
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function createRepositoryRepairProposal(
  input: Omit<
    RepositoryRepairProposal,
    "proposalId" | "digest" | "approvalStatement" | "createdAt" | "expiresAt"
  >,
  now = new Date(),
): RepositoryRepairProposal {
  if (
    !unique(input.editableFiles) ||
    !unique(input.contextFiles) ||
    !unique(input.verificationCommands) ||
    input.baseRevision !== input.expectedRemoteRevision
  )
    throw new Error("REPAIR_PROPOSAL_DENIED");
  const base = {
    ...input,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + repositoryRepairApprovalWindowMs).toISOString(),
  };
  const digest = `sha256:${createHash("sha256").update(JSON.stringify(base)).digest("hex")}`;
  const proposalId = `proposal_release-seven-${digest.slice(7, 19)}`;
  return repositoryRepairProposalSchema.parse({
    ...base,
    proposalId,
    digest,
    approvalStatement: `I approve repository repair ${proposalId} at ${digest} for one disposable local qwen3:8b candidate generation and verification exactly as proposed.`,
  });
}

export function bindRepositoryRepairCode(
  secret: string,
  proposal: RepositoryRepairProposal,
  code: string,
): string {
  return createHmac("sha256", secret).update(`${proposal.digest}\n${code}`).digest("hex");
}

export function verifyRepositoryRepairApproval(input: {
  proposal: RepositoryRepairProposal;
  statement: string;
  code: string;
  expectedCodeBinding: string;
  bindingSecret: string;
  now?: Date;
}): boolean {
  const proposal = repositoryRepairProposalSchema.parse(input.proposal);
  const now = input.now ?? new Date();
  if (
    input.statement !== proposal.approvalStatement ||
    !/^\d{8}$/u.test(input.code) ||
    now.getTime() >= Date.parse(proposal.expiresAt) ||
    !/^[a-f0-9]{64}$/u.test(input.expectedCodeBinding)
  )
    return false;
  const actual = bindRepositoryRepairCode(input.bindingSecret, proposal, input.code);
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(input.expectedCodeBinding, "hex"));
}

function changedLineCount(before: string, after: string): number {
  const a = before.split(/\r?\n/u);
  const b = after.split(/\r?\n/u);
  let changed = Math.abs(a.length - b.length);
  for (let index = 0; index < Math.min(a.length, b.length); index++)
    if (a[index] !== b[index]) changed++;
  return changed;
}

export function validateRepositoryRepairCandidate(
  value: unknown,
  proposalInput: RepositoryRepairProposal,
  before: Readonly<Record<string, string>>,
): RepositoryRepairCandidate {
  const proposal = repositoryRepairProposalSchema.parse(proposalInput);
  const candidate = repositoryRepairCandidateSchema.parse(value);
  const allowed = new Set(proposal.editableFiles);
  if (!unique(candidate.files.map((file) => file.path))) throw new Error("DUPLICATE_FILE");
  let bytes = 0;
  let changedLines = 0;
  for (const file of candidate.files) {
    if (!allowed.has(file.path) || !(file.path in before)) throw new Error("CANDIDATE_PATH_DENIED");
    if (
      file.content.includes("\u0000") ||
      file.content.includes("\uFFFD") ||
      /(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}/u.test(file.content) ||
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(file.content)
    )
      throw new Error("CANDIDATE_CONTENT_DENIED");
    if (file.content === before[file.path]) throw new Error("CANDIDATE_NOOP_DENIED");
    bytes += Buffer.byteLength(file.content);
    changedLines += changedLineCount(before[file.path] ?? "", file.content);
  }
  if (bytes > proposal.maximumCandidateBytes) throw new Error("CANDIDATE_OVERSIZED");
  if (changedLines > proposal.maximumChangedLines) throw new Error("CANDIDATE_CHANGE_LIMIT");
  return candidate;
}
