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

export function createRepositoryRepairIdleDeadline(
  proposalInput: RepositoryRepairProposal,
  activityAtMs: number,
): number {
  const proposal = repositoryRepairProposalSchema.parse(proposalInput);
  const activityAt = z.number().int().nonnegative().parse(activityAtMs);
  return activityAt + proposal.maximumRuntimeSeconds * 1_000;
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
    "proposalId" | "digest" | "approvalStatement" | "createdAt"
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
  if (
    input.statement !== proposal.approvalStatement ||
    !/^\d{8}$/u.test(input.code) ||
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

const repositoryRepairStageEditSchema = z.strictObject({
  path: safePathSchema,
  before: z.string().min(1).max(65_536),
  after: z.string().max(65_536),
  rationale: z.string().min(1).max(2_000),
  expectedVerificationImpact: z.string().min(1).max(2_000),
});
const repositoryRepairContextRequestSchema = z.strictObject({
  path: safePathSchema,
  query: z.string().min(1).max(500),
  reason: z.string().min(1).max(1_000),
});
const repositoryRepairStageCandidateSchema = z.strictObject({
  summary: z.string().min(1).max(4_000),
  edits: z.array(repositoryRepairStageEditSchema).max(100),
  contextRequests: z.array(repositoryRepairContextRequestSchema).max(12),
});
export type RepositoryRepairContextRequest = z.infer<typeof repositoryRepairContextRequestSchema>;

export function createRepositoryRepairStageModelSchema(
  proposalInput: RepositoryRepairProposal,
): Record<string, unknown> {
  repositoryRepairProposalSchema.parse(proposalInput);
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "edits", "contextRequests"],
    properties: {
      summary: { type: "string" },
      edits: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "before", "after", "rationale", "expectedVerificationImpact"],
          properties: {
            path: { type: "string" },
            before: { type: "string" },
            after: { type: "string" },
            rationale: { type: "string" },
            expectedVerificationImpact: { type: "string" },
          },
        },
      },
      contextRequests: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "query", "reason"],
          properties: {
            path: { type: "string" },
            query: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  };
}

function deniedRepairContent(value: string): boolean {
  return (
    value.includes("\u0000") ||
    value.includes("\uFFFD") ||
    /(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}/u.test(value) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u.test(value)
  );
}

function occurrenceCount(content: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (offset <= content.length - needle.length) {
    const found = content.indexOf(needle, offset);
    if (found === -1) break;
    count++;
    offset = found + Math.max(1, needle.length);
  }
  return count;
}

export function validateRepositoryRepairStageCandidate(
  value: unknown,
  proposalInput: RepositoryRepairProposal,
  targetPathInput: string,
  currentFiles: Readonly<Record<string, string>>,
):
  | { kind: "context-request"; requests: RepositoryRepairContextRequest[] }
  | { kind: "edits"; summary: string; files: RepositoryRepairCandidate["files"] } {
  const proposal = repositoryRepairProposalSchema.parse(proposalInput);
  const targetPath = safePathSchema.parse(targetPathInput);
  const candidate = repositoryRepairStageCandidateSchema.parse(value);
  if (!proposal.editableFiles.includes(targetPath) || !(targetPath in currentFiles))
    throw new Error("STAGE_TARGET_DENIED");
  if (candidate.edits.length > 0 && candidate.contextRequests.length > 0)
    throw new Error("STAGE_MIXED_RESPONSE_DENIED");
  if (candidate.edits.length === 0 && candidate.contextRequests.length === 0)
    throw new Error("STAGE_EMPTY_DENIED");

  if (candidate.contextRequests.length > 0) {
    const contextPaths = new Set([...proposal.editableFiles, ...proposal.contextFiles]);
    if (!unique(candidate.contextRequests.map((request) => `${request.path}\n${request.query}`)))
      throw new Error("DUPLICATE_CONTEXT_REQUEST");
    for (const request of candidate.contextRequests) {
      if (!contextPaths.has(request.path) || !(request.path in currentFiles))
        throw new Error("CONTEXT_PATH_DENIED");
      if (deniedRepairContent(`${request.query}\n${request.reason}`))
        throw new Error("CANDIDATE_CONTENT_DENIED");
    }
    return { kind: "context-request", requests: candidate.contextRequests };
  }

  let content = currentFiles[targetPath] ?? "";
  const rationales: string[] = [];
  const impacts: string[] = [];
  for (const edit of candidate.edits) {
    if (edit.path !== targetPath) throw new Error("STAGE_TARGET_DENIED");
    if (edit.before === edit.after) throw new Error("CANDIDATE_NOOP_DENIED");
    if (deniedRepairContent(edit.after)) throw new Error("CANDIDATE_CONTENT_DENIED");
    const matches = occurrenceCount(content, edit.before);
    if (matches === 0) throw new Error("STAGE_EDIT_STALE");
    if (matches !== 1) throw new Error("STAGE_EDIT_AMBIGUOUS");
    content = content.replace(edit.before, edit.after);
    rationales.push(edit.rationale);
    impacts.push(edit.expectedVerificationImpact);
  }

  const materialized = validateRepositoryRepairCandidate(
    {
      summary: candidate.summary,
      files: [
        {
          path: targetPath,
          content,
          rationale: rationales.join("\n"),
          expectedVerificationImpact: impacts.join("\n"),
        },
      ],
    },
    proposal,
    currentFiles,
  );
  return { kind: "edits", summary: materialized.summary, files: materialized.files };
}

const repositoryRepairStageSliceSchema = z.strictObject({
  path: safePathSchema,
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  digest: digestSchema,
  content: z.string(),
});
export const repositoryRepairStagePacketSchema = z.strictObject({
  defectStatement: z.string().min(10).max(4_000),
  targetPath: safePathSchema,
  verificationCommands: z.array(repairVerificationCommandSchema).min(1).max(9),
  priorRequests: z.array(repositoryRepairContextRequestSchema).max(12),
  slices: z.array(repositoryRepairStageSliceSchema).min(1),
});
export type RepositoryRepairStagePacket = z.infer<typeof repositoryRepairStagePacketSchema>;

function repairTokens(value: string): string[] {
  return [
    ...new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9_]+/u)
        .filter((token) => token.length >= 2),
    ),
  ];
}

export function createRepositoryRepairStagePacket(input: {
  proposal: RepositoryRepairProposal;
  targetPath: string;
  files: Readonly<Record<string, string>>;
  priorRequests?: readonly RepositoryRepairContextRequest[];
  maximumBytes: number;
}): RepositoryRepairStagePacket {
  const proposal = repositoryRepairProposalSchema.parse(input.proposal);
  const targetPath = safePathSchema.parse(input.targetPath);
  const maximumBytes = z
    .number()
    .int()
    .min(1_024)
    .max(proposal.maximumInputBytes)
    .parse(input.maximumBytes);
  const priorRequests = z
    .array(repositoryRepairContextRequestSchema)
    .max(12)
    .parse(input.priorRequests ?? []);
  const allowedPaths = new Set([...proposal.editableFiles, ...proposal.contextFiles]);
  if (!proposal.editableFiles.includes(targetPath) || !(targetPath in input.files))
    throw new Error("STAGE_TARGET_DENIED");
  for (const request of priorRequests)
    if (!allowedPaths.has(request.path) || !(request.path in input.files))
      throw new Error("CONTEXT_PATH_DENIED");

  const queryByPath = new Map<string, string[]>();
  for (const request of priorRequests)
    queryByPath.set(request.path, [
      ...(queryByPath.get(request.path) ?? []),
      ...repairTokens(request.query),
    ]);
  const globalTokens = repairTokens(
    `${proposal.defectStatement}\n${targetPath}\n${priorRequests.map((request) => request.query).join("\n")}`,
  );
  const candidates: (z.infer<typeof repositoryRepairStageSliceSchema> & { score: number })[] = [];
  const seenPaths = new Set<string>();
  const paths = [targetPath, ...proposal.contextFiles, ...proposal.editableFiles];
  for (const path of paths) {
    if (seenPaths.has(path) || !allowedPaths.has(path) || !(path in input.files)) continue;
    seenPaths.add(path);
    const lines = (input.files[path] ?? "").split(/\r?\n/u);
    const windowSize = 40;
    for (let start = 0; start < lines.length; start += windowSize) {
      const end = Math.min(lines.length, start + windowSize);
      const content = lines.slice(start, end).join("\n");
      const lower = content.toLowerCase();
      const pathTokens = queryByPath.get(path) ?? [];
      const tokenScore = globalTokens.reduce(
        (score, token) => score + (lower.includes(token) ? 2 : 0),
        0,
      );
      const requestScore = pathTokens.reduce(
        (score, token) => score + (lower.includes(token) ? 100 : 0),
        0,
      );
      const anchorScore = /\b(?:export|function|class|interface|type|describe|it|test)\b/u.test(
        content,
      )
        ? 10
        : 0;
      candidates.push({
        path,
        startLine: start + 1,
        endLine: end,
        digest: `sha256:${createHash("sha256").update(content).digest("hex")}`,
        content,
        score: (path === targetPath ? 50 : 0) + tokenScore + requestScore + anchorScore,
      });
    }
  }
  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.path.localeCompare(right.path) ||
      left.startLine - right.startLine,
  );

  let packet: RepositoryRepairStagePacket = {
    defectStatement: proposal.defectStatement,
    targetPath,
    verificationCommands: proposal.verificationCommands,
    priorRequests,
    slices: [],
  };
  const selected = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.path}:${String(candidate.startLine)}:${String(candidate.endLine)}:${candidate.digest}`;
    if (selected.has(key)) continue;
    const slice = {
      path: candidate.path,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      digest: candidate.digest,
      content: candidate.content,
    };
    const next = { ...packet, slices: [...packet.slices, slice] };
    if (Buffer.byteLength(JSON.stringify(next)) > maximumBytes) continue;
    selected.add(key);
    packet = next;
  }
  if (packet.slices.length === 0 || !packet.slices.some((slice) => slice.path === targetPath))
    throw new Error("CONTEXT_PACKET_BUDGET_DENIED");
  return repositoryRepairStagePacketSchema.parse(packet);
}

const repositoryRepairJournalStageSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  path: safePathSchema,
  afterDigest: digestSchema,
  modelOutputDigest: digestSchema,
  completedAt: z.iso.datetime(),
});
export const repositoryRepairJournalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  scopeDigest: digestSchema,
  repository: repairRepositorySchema,
  baseRevision: revisionSchema,
  expectedRemoteRevision: revisionSchema,
  candidateId: z.string().regex(/^candidate_release-seven-[a-f0-9]{12}$/),
  candidateHead: revisionSchema,
  canonicalBeforeDigests: z.record(safePathSchema, digestSchema),
  completedStages: z.array(repositoryRepairJournalStageSchema).max(20),
  contextSlices: z.array(repositoryRepairStageSliceSchema.omit({ content: true })).max(240),
  lastProgressAt: z.iso.datetime(),
  state: z.enum(["active", "failed", "verified"]),
});
export type RepositoryRepairJournal = z.infer<typeof repositoryRepairJournalSchema>;

export function createRepositoryRepairScopeDigest(
  proposalInput: RepositoryRepairProposal,
): `sha256:${string}` {
  const proposal = repositoryRepairProposalSchema.parse(proposalInput);
  const scope: Partial<RepositoryRepairProposal> = { ...proposal };
  delete scope.approvalStatement;
  delete scope.createdAt;
  delete scope.digest;
  delete scope.proposalId;
  return `sha256:${createHash("sha256").update(JSON.stringify(scope)).digest("hex")}`;
}

export function assertRepositoryRepairCleanupState(
  candidateExists: boolean,
  journalExists: boolean,
): "completed" {
  if (candidateExists || journalExists) throw new Error("REPAIR_CLEANUP_FAILED");
  return "completed";
}

export function validateRepositoryRepairWorkingSet(input: {
  proposal: RepositoryRepairProposal;
  journal: RepositoryRepairJournal;
  currentFiles: Readonly<Record<string, string>>;
}): true {
  const proposal = repositoryRepairProposalSchema.parse(input.proposal);
  const journal = repositoryRepairJournalSchema.parse(input.journal);
  const completed = new Map(
    journal.completedStages.map((stage) => [stage.path, stage.afterDigest]),
  );
  const allPaths = [...new Set([...proposal.editableFiles, ...proposal.contextFiles])];
  for (const path of allPaths) {
    const content = input.currentFiles[path];
    const expected = completed.get(path) ?? journal.canonicalBeforeDigests[path];
    if (typeof content !== "string" || !expected) throw new Error("REPAIR_WORKING_SET_TAMPERED");
    const actual = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    if (actual !== expected) throw new Error("REPAIR_WORKING_SET_TAMPERED");
  }
  return true;
}

export function validateRepositoryRepairResume(input: {
  proposal: RepositoryRepairProposal;
  journal: RepositoryRepairJournal;
  candidateHead: string;
  currentFiles: Readonly<Record<string, string>>;
  changedPaths: readonly string[];
}): { nextStageIndex: number } {
  const proposal = repositoryRepairProposalSchema.parse(input.proposal);
  const journal = repositoryRepairJournalSchema.parse(input.journal);
  if (
    journal.scopeDigest !== createRepositoryRepairScopeDigest(proposal) ||
    journal.repository !== proposal.repository ||
    journal.baseRevision !== proposal.baseRevision ||
    journal.expectedRemoteRevision !== proposal.expectedRemoteRevision
  )
    throw new Error("REPAIR_RESUME_SCOPE_MISMATCH");
  if (
    input.candidateHead !== proposal.baseRevision ||
    journal.candidateHead !== proposal.baseRevision
  )
    throw new Error("REPAIR_RESUME_HEAD_MISMATCH");
  const allowed = new Set(proposal.editableFiles);
  if (!unique(input.changedPaths) || input.changedPaths.some((path) => !allowed.has(path)))
    throw new Error("REPAIR_RESUME_PATH_DENIED");
  for (let index = 0; index < journal.completedStages.length; index++) {
    const stage = journal.completedStages[index];
    if (stage?.index !== index || stage.path !== proposal.editableFiles[index])
      throw new Error("REPAIR_RESUME_STAGE_MISMATCH");
  }
  try {
    validateRepositoryRepairWorkingSet({ proposal, journal, currentFiles: input.currentFiles });
  } catch {
    throw new Error("REPAIR_RESUME_TAMPERED");
  }
  const completed = new Map(
    journal.completedStages.map((stage) => [stage.path, stage.afterDigest]),
  );
  const expectedChanged = [...completed.keys()].sort();
  if (JSON.stringify([...input.changedPaths].sort()) !== JSON.stringify(expectedChanged))
    throw new Error("REPAIR_RESUME_PATH_DENIED");
  return { nextStageIndex: journal.completedStages.length };
}
