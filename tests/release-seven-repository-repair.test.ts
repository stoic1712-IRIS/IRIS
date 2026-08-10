import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertRepositoryRepairCheckoutContent,
  assertRepositoryRepairCleanupState,
  bindRepositoryRepairCode,
  createRepositoryRepairModelSchema,
  createRepositoryRepairIdleDeadline,
  createRepositoryRepairProposal,
  createRepositoryRepairScopeDigest,
  createRepositoryRepairStageModelSchema,
  createRepositoryRepairStagePacket,
  formatRepositoryRepairModelDenial,
  repositoryRepairJournalSchema,
  repositoryRepairBootstrapCommand,
  repositoryRepairResultPayloadSchema,
  repositoryRepairResultSchema,
  type RepositoryRepairProposal,
  validateRepositoryRepairCandidate,
  validateRepositoryRepairResume,
  validateRepositoryRepairWorkingSet,
  validateRepositoryRepairStageCandidate,
  verifyRepositoryRepairApproval,
} from "../packages/kernel/src/index.js";

const input: Omit<
  RepositoryRepairProposal,
  "proposalId" | "digest" | "approvalStatement" | "createdAt"
> = {
  repository: "stoic1712-IRIS/IRIS" as const,
  baseRevision: "a".repeat(40),
  expectedRemoteRevision: "a".repeat(40),
  findingDigest: `sha256:${"b".repeat(64)}`,
  defectStatement: "The approved fictional defect requires a bounded two-file repair.",
  editableFiles: ["src/a.ts", "src/b.ts"],
  contextFiles: ["src/context.ts"],
  verificationCommands: ["strict-typecheck", "unit-and-integration-tests"],
  model: "qwen3:8b" as const,
  modelEndpoint: "http://127.0.0.1:11434" as const,
  maximumInputBytes: 1_048_576 as const,
  maximumCandidateBytes: 524_288 as const,
  maximumModelOutputBytes: 65_536 as const,
  maximumChangedLines: 2_000 as const,
  maximumRuntimeSeconds: 600 as const,
  maximumRetentionSeconds: 1_800 as const,
  maximumCostUsd: 0 as const,
  canonicalWriteAuthority: false as const,
  candidateWriteAuthority: true as const,
  githubAuthority: false as const,
  networkAuthority: false as const,
};

describe("Release Seven governed repository repair", () => {
  it("resolves approved repositories from launcher-owned canonical roots", () => {
    const source = readFileSync("scripts/runtime/iris-repository-repair-worker.mjs", "utf8");
    expect(source).toContain("process.env.IRIS_ROOT");
    expect(source).toContain("process.env.IRIS_COMMAND_CENTER_ROOT");
    expect(source).not.toContain("STOIC-IRIS-release-seven");
    expect(source).not.toContain("iris-founder-command-center-release-seven");
  });

  it("creates a deterministic exact zero-canonical-authority proposal", () => {
    const now = new Date("2026-08-05T22:00:00Z");
    const proposal = createRepositoryRepairProposal(input, now);
    expect(proposal).toEqual(createRepositoryRepairProposal(input, now));
    expect(proposal.canonicalWriteAuthority).toBe(false);
    expect(proposal.githubAuthority).toBe(false);
    expect(proposal.candidateWriteAuthority).toBe(true);
  });

  it("rejects revision drift and duplicate proposal scope", () => {
    expect(() =>
      createRepositoryRepairProposal({ ...input, expectedRemoteRevision: "c".repeat(40) }),
    ).toThrow("REPAIR_PROPOSAL_DENIED");
    expect(() =>
      createRepositoryRepairProposal({ ...input, editableFiles: ["src/a.ts", "src/a.ts"] }),
    ).toThrow("REPAIR_PROPOSAL_DENIED");
    expect(() =>
      createRepositoryRepairProposal({ ...input, editableFiles: ["src/a.ts;whoami"] }),
    ).toThrow();
  });

  it("requires exact persistent one-time approval material", () => {
    const now = new Date("2026-08-05T22:00:00Z");
    const proposal = createRepositoryRepairProposal(input, now);
    const secret = "c".repeat(64);
    const code = "12345678";
    const expectedCodeBinding = bindRepositoryRepairCode(secret, proposal, code);
    expect(
      verifyRepositoryRepairApproval({
        proposal,
        statement: proposal.approvalStatement,
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now,
      }),
    ).toBe(true);
    expect(
      verifyRepositoryRepairApproval({
        proposal,
        statement: `${proposal.approvalStatement} `,
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now,
      }),
    ).toBe(false);
    expect("expiresAt" in proposal).toBe(false);
    expect(
      verifyRepositoryRepairApproval({
        proposal,
        statement: proposal.approvalStatement,
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now: new Date("2027-08-05T22:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("accepts only bounded unique allowlisted complete-file replacements", () => {
    const proposal = createRepositoryRepairProposal(input);
    const before = { "src/a.ts": "export const a = 1;\n", "src/b.ts": "export const b = 1;\n" };
    const candidate = {
      summary: "Repair both fictional defects.",
      files: [
        {
          path: "src/a.ts",
          content: "export const a = 2;\n",
          rationale: "Correct the first value.",
          expectedVerificationImpact: "The first assertion passes.",
        },
        {
          path: "src/b.ts",
          content: "export const b = 2;\n",
          rationale: "Correct the second value.",
          expectedVerificationImpact: "The second assertion passes.",
        },
      ],
    };
    expect(validateRepositoryRepairCandidate(candidate, proposal, before)).toEqual(candidate);
    expect(() =>
      validateRepositoryRepairCandidate(
        { ...candidate, files: [{ ...candidate.files[0], path: "src/invented.ts" }] },
        proposal,
        before,
      ),
    ).toThrow("CANDIDATE_PATH_DENIED");
    expect(() =>
      validateRepositoryRepairCandidate(
        { ...candidate, files: [candidate.files[0], candidate.files[0]] },
        proposal,
        before,
      ),
    ).toThrow("DUPLICATE_FILE");
    expect(() =>
      validateRepositoryRepairCandidate(
        { ...candidate, files: [{ ...candidate.files[0], content: before["src/a.ts"] }] },
        proposal,
        before,
      ),
    ).toThrow("CANDIDATE_NOOP_DENIED");
    expect(() =>
      validateRepositoryRepairCandidate(
        {
          ...candidate,
          files: [
            {
              ...candidate.files[0],
              content: "export const token = 'github_pat_12345678901234567890';\n",
            },
          ],
        },
        proposal,
        before,
      ),
    ).toThrow("CANDIDATE_CONTENT_DENIED");
  });

  it("rejects authority-bearing result fields", () => {
    expect(() =>
      repositoryRepairResultSchema.parse({
        verdict: "verified",
        summary: "verified",
        repository: "stoic1712-IRIS/IRIS",
        baseRevision: "a".repeat(40),
        candidateId: "candidate_release-seven-aaaaaaaaaaaa",
        diffDigest: `sha256:${"b".repeat(64)}`,
        changedFiles: [
          {
            path: "src/a.ts",
            beforeDigest: `sha256:${"c".repeat(64)}`,
            afterDigest: `sha256:${"d".repeat(64)}`,
          },
        ],
        diff: "diff",
        verification: [],
        canonicalRepositoryChanged: false,
        githubChanged: false,
        cleanupState: "completed",
        expiresAt: new Date().toISOString(),
        merged: true,
      }),
    ).toThrow();
  });

  it("reports only non-sensitive model denial metadata", () => {
    const evidence = formatRepositoryRepairModelDenial(500, 12_345);
    expect(evidence).toBe("MODEL_OUTPUT_DENIED status=500 bytes=12345");
    expect(evidence).not.toContain("response body");
    expect(() => formatRepositoryRepairModelDenial(99, 1)).toThrow();
    expect(() => formatRepositoryRepairModelDenial(500, -1)).toThrow();
  });

  it("uses a structural-only model schema while local validation retains limits", () => {
    const proposal = createRepositoryRepairProposal(input);
    const schema = createRepositoryRepairModelSchema(proposal);
    const serialized = JSON.stringify(schema);

    expect(serialized).not.toContain("maxLength");
    expect(serialized).not.toContain("minItems");
    expect(serialized).not.toContain("maxItems");
    expect(serialized).not.toContain('"enum"');
    expect(serialized).toContain('"additionalProperties":false');
    expect(() =>
      validateRepositoryRepairCandidate(
        {
          summary: "Denied locally.",
          files: [
            {
              path: "src/not-approved.ts",
              content: "export {};\n",
              rationale: "Unapproved path.",
              expectedVerificationImpact: "None.",
            },
          ],
        },
        proposal,
        { "src/a.ts": "export const a = 1;\n", "src/b.ts": "export const b = 1;\n" },
      ),
    ).toThrow("CANDIDATE_PATH_DENIED");
  });

  it("accepts only exact or CRLF-normalized checkout content", () => {
    expect(() => {
      assertRepositoryRepairCheckoutContent("first\nsecond\n", "first\nsecond\n");
    }).not.toThrow();
    expect(() => {
      assertRepositoryRepairCheckoutContent("first\r\nsecond\r\n", "first\nsecond\n");
    }).not.toThrow();
    expect(() => {
      assertRepositoryRepairCheckoutContent("first\rsecond\r", "first\nsecond\n");
    }).toThrow("CANDIDATE_DRIFT");
    expect(() => {
      assertRepositoryRepairCheckoutContent("first\r\nchanged\r\n", "first\nsecond\n");
    }).toThrow("CANDIDATE_DRIFT");
    expect(() => {
      assertRepositoryRepairCheckoutContent("first\r\nsecond\r\nextra\r\n", "first\nsecond\n");
    }).toThrow("CANDIDATE_DRIFT");
  });

  it("uses the pinned repository build as the disposable workspace bootstrap", () => {
    expect(repositoryRepairBootstrapCommand).toBe("pnpm build");
  });

  it("materializes bounded exact edits only for the active target", () => {
    const proposal = createRepositoryRepairProposal(input);
    const before = {
      "src/a.ts": "export const a = 1;\nexport const keep = true;\n",
      "src/b.ts": "export const b = 1;\n",
      "src/context.ts": "export const context = true;\n",
    };
    const stage = {
      summary: "Repair the active target.",
      edits: [
        {
          path: "src/a.ts",
          before: "export const a = 1;",
          after: "export const a = 2;",
          rationale: "Correct the fictional value.",
          expectedVerificationImpact: "The value assertion passes.",
        },
      ],
      contextRequests: [],
    };

    expect(validateRepositoryRepairStageCandidate(stage, proposal, "src/a.ts", before)).toEqual({
      kind: "edits",
      summary: stage.summary,
      files: [
        {
          path: "src/a.ts",
          content: "export const a = 2;\nexport const keep = true;\n",
          rationale: stage.edits[0]?.rationale,
          expectedVerificationImpact: stage.edits[0]?.expectedVerificationImpact,
        },
      ],
    });
    expect(() =>
      validateRepositoryRepairStageCandidate(
        { ...stage, edits: [{ ...stage.edits[0], path: "src/b.ts" }] },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("STAGE_TARGET_DENIED");
    expect(() =>
      validateRepositoryRepairStageCandidate(
        { ...stage, edits: [{ ...stage.edits[0], before: "missing" }] },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("STAGE_EDIT_STALE");
    expect(() =>
      validateRepositoryRepairStageCandidate(
        {
          ...stage,
          edits: [
            {
              ...stage.edits[0],
              before: "export const",
              after: "export let",
            },
          ],
        },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("STAGE_EDIT_AMBIGUOUS");
    expect(() =>
      validateRepositoryRepairStageCandidate(
        { ...stage, edits: [{ ...stage.edits[0], after: stage.edits[0]?.before }] },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("CANDIDATE_NOOP_DENIED");
    expect(() =>
      validateRepositoryRepairStageCandidate(
        {
          ...stage,
          edits: [
            {
              ...stage.edits[0],
              after: "export const token = 'github_pat_12345678901234567890';",
            },
          ],
        },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("CANDIDATE_CONTENT_DENIED");
  });

  it("accepts bounded allowlisted context requests without mixing edits", () => {
    const proposal = createRepositoryRepairProposal(input);
    const before = {
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 1;\n",
      "src/context.ts": "export function helper() { return true; }\n",
    };
    const request = {
      summary: "Need the helper declaration.",
      edits: [],
      contextRequests: [
        { path: "src/context.ts", query: "helper declaration", reason: "Confirm its contract." },
      ],
    };

    expect(validateRepositoryRepairStageCandidate(request, proposal, "src/a.ts", before)).toEqual({
      kind: "context-request",
      requests: request.contextRequests,
    });
    expect(() =>
      validateRepositoryRepairStageCandidate(
        {
          ...request,
          contextRequests: [{ ...request.contextRequests[0], path: "src/unknown.ts" }],
        },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("CONTEXT_PATH_DENIED");
    expect(() =>
      validateRepositoryRepairStageCandidate(
        {
          ...request,
          edits: [
            {
              path: "src/a.ts",
              before: "export const a = 1;",
              after: "export const a = 2;",
              rationale: "Repair.",
              expectedVerificationImpact: "Pass.",
            },
          ],
        },
        proposal,
        "src/a.ts",
        before,
      ),
    ).toThrow("STAGE_MIXED_RESPONSE_DENIED");

    const schema = JSON.stringify(createRepositoryRepairStageModelSchema(proposal));
    expect(schema).toContain('"contextRequests"');
    expect(schema).toContain('"before"');
    expect(schema).not.toContain("maxLength");
    expect(schema).not.toContain('"enum"');
  });

  it("creates deterministic deduplicated line-addressed packets within the byte ceiling", () => {
    const proposal = createRepositoryRepairProposal({
      ...input,
      contextFiles: ["src/a.ts", "src/context.ts"],
    });
    const files = {
      "src/a.ts": Array.from({ length: 240 }, (_, index) =>
        index === 119
          ? "export function brokenHandler() { return false; }"
          : `// target ${String(index)}`,
      ).join("\n"),
      "src/b.ts": "export const b = 1;\n",
      "src/context.ts": Array.from({ length: 240 }, (_, index) =>
        index === 180
          ? "export function expectedHelper() { return true; }"
          : `// context ${String(index)}`,
      ).join("\n"),
    };
    const packet = createRepositoryRepairStagePacket({
      proposal,
      targetPath: "src/a.ts",
      files,
      priorRequests: [
        { path: "src/context.ts", query: "expectedHelper", reason: "Need its declaration." },
      ],
      maximumBytes: 4_096,
    });
    const repeated = createRepositoryRepairStagePacket({
      proposal,
      targetPath: "src/a.ts",
      files,
      priorRequests: [
        { path: "src/context.ts", query: "expectedHelper", reason: "Need its declaration." },
      ],
      maximumBytes: 4_096,
    });

    expect(packet).toEqual(repeated);
    expect(Buffer.byteLength(JSON.stringify(packet))).toBeLessThanOrEqual(4_096);
    expect(packet.slices.some((slice) => slice.content.includes("brokenHandler"))).toBe(true);
    expect(packet.slices.some((slice) => slice.content.includes("expectedHelper"))).toBe(true);
    expect(packet.slices.every((slice) => slice.startLine >= 1)).toBe(true);
    expect(packet.slices.every((slice) => slice.endLine >= slice.startLine)).toBe(true);
    expect(
      new Set(
        packet.slices.map(
          (slice) => `${slice.path}:${String(slice.startLine)}:${String(slice.endLine)}`,
        ),
      ).size,
    ).toBe(packet.slices.length);
    expect(packet.slices.filter((slice) => slice.path === "src/a.ts").length).toBeGreaterThan(0);
  });

  it("binds retained journals to exact compatible scope and candidate digests", () => {
    const first = createRepositoryRepairProposal(input, new Date("2026-08-10T18:00:00.000Z"));
    const replacement = createRepositoryRepairProposal(input, new Date("2026-08-10T19:00:00.000Z"));
    const canonicalBefore = "export const a = 1;\n";
    const staged = "export const a = 2;\n";
    const digest = (value: string) =>
      `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
    const journal = repositoryRepairJournalSchema.parse({
      schemaVersion: 1,
      scopeDigest: createRepositoryRepairScopeDigest(first),
      repository: first.repository,
      baseRevision: first.baseRevision,
      expectedRemoteRevision: first.expectedRemoteRevision,
      candidateId: `candidate_release-seven-${first.digest.slice(7, 19)}`,
      candidateHead: first.baseRevision,
      canonicalBeforeDigests: {
        "src/a.ts": digest(canonicalBefore),
        "src/b.ts": digest("export const b = 1;\n"),
        "src/context.ts": digest("export const context = true;\n"),
      },
      completedStages: [
        {
          index: 0,
          path: "src/a.ts",
          afterDigest: digest(staged),
          modelOutputDigest: digest("model output"),
          completedAt: "2026-08-10T18:01:00.000Z",
        },
      ],
      contextSlices: [],
      lastProgressAt: "2026-08-10T18:01:00.000Z",
      state: "active",
    });

    expect(createRepositoryRepairScopeDigest(replacement)).toBe(journal.scopeDigest);
    expect(
      validateRepositoryRepairResume({
        proposal: replacement,
        journal,
        candidateHead: replacement.baseRevision,
        currentFiles: {
          "src/a.ts": staged,
          "src/b.ts": "export const b = 1;\n",
          "src/context.ts": "export const context = true;\n",
        },
        changedPaths: ["src/a.ts"],
      }),
    ).toEqual({ nextStageIndex: 1 });
    expect(() =>
      validateRepositoryRepairResume({
        proposal: replacement,
        journal,
        candidateHead: replacement.baseRevision,
        currentFiles: {
          "src/a.ts": "tampered\n",
          "src/b.ts": "export const b = 1;\n",
          "src/context.ts": "export const context = true;\n",
        },
        changedPaths: ["src/a.ts"],
      }),
    ).toThrow("REPAIR_RESUME_TAMPERED");
    expect(() =>
      validateRepositoryRepairResume({
        proposal: replacement,
        journal,
        candidateHead: replacement.baseRevision,
        currentFiles: {
          "src/a.ts": staged,
          "src/b.ts": "export const b = 1;\n",
          "src/context.ts": "export const context = true;\n",
        },
        changedPaths: ["src/a.ts", "src/invented.ts"],
      }),
    ).toThrow("REPAIR_RESUME_PATH_DENIED");
    expect(() =>
      validateRepositoryRepairResume({
        proposal: createRepositoryRepairProposal({
          ...input,
          defectStatement: `${input.defectStatement} Changed.`,
        }),
        journal,
        candidateHead: replacement.baseRevision,
        currentFiles: {
          "src/a.ts": staged,
          "src/b.ts": "export const b = 1;\n",
          "src/context.ts": "export const context = true;\n",
        },
        changedPaths: ["src/a.ts"],
      }),
    ).toThrow("REPAIR_RESUME_SCOPE_MISMATCH");
  });

  it("uses staged streaming model generation and bounded progress evidence", () => {
    const source = readFileSync("scripts/runtime/iris-repository-repair-worker.mjs", "utf8");
    expect(source).toContain("stream: true");
    expect(source).toContain("response.body.getReader()");
    expect(source).toContain("proposal.editableFiles.entries()");
    expect(source).toContain("REPAIR_PROGRESS");
    expect(source).toContain(".iris-repair-journal.json");
    expect(source).not.toContain("complete replacement text");
    expect(source).not.toContain("maximum = 120_000");
  });

  it("detects every tracked change state before enforcing the path allowlist", () => {
    const source = readFileSync("scripts/runtime/iris-repository-repair-worker.mjs", "utf8");

    expect(source).not.toContain('"--diff-filter=M"');
    expect(source).toContain('"diff", "--name-only", "--no-renames", "-z"');
    expect(source).toMatch(/"diff",\s*"--cached",\s*"--name-only",\s*"--no-renames",\s*"-z"/u);
    expect(source).toMatch(/"ls-files",\s*"--others",\s*"--exclude-standard",\s*"-z"/u);
  });

  it("binds every stage packet to canonical and checkpointed file digests", () => {
    const proposal = createRepositoryRepairProposal(input);
    const canonicalA = "export const a = 1;\n";
    const stagedA = "export const a = 2;\n";
    const canonicalB = "export const b = 1;\n";
    const canonicalContext = "export const context = true;\n";
    const digest = (value: string) =>
      `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
    const journal = repositoryRepairJournalSchema.parse({
      schemaVersion: 1,
      scopeDigest: createRepositoryRepairScopeDigest(proposal),
      repository: proposal.repository,
      baseRevision: proposal.baseRevision,
      expectedRemoteRevision: proposal.expectedRemoteRevision,
      candidateId: `candidate_release-seven-${proposal.digest.slice(7, 19)}`,
      candidateHead: proposal.baseRevision,
      canonicalBeforeDigests: {
        "src/a.ts": digest(canonicalA),
        "src/b.ts": digest(canonicalB),
        "src/context.ts": digest(canonicalContext),
      },
      completedStages: [
        {
          index: 0,
          path: "src/a.ts",
          afterDigest: digest(stagedA),
          modelOutputDigest: digest("model output"),
          completedAt: "2026-08-10T18:01:00.000Z",
        },
      ],
      contextSlices: [],
      lastProgressAt: "2026-08-10T18:01:00.000Z",
      state: "active",
    });

    const valid = {
      "src/a.ts": stagedA,
      "src/b.ts": canonicalB,
      "src/context.ts": canonicalContext,
    };
    expect(validateRepositoryRepairWorkingSet({ proposal, journal, currentFiles: valid })).toBe(
      true,
    );
    expect(() =>
      validateRepositoryRepairWorkingSet({
        proposal,
        journal,
        currentFiles: { ...valid, "src/context.ts": "tampered context\n" },
      }),
    ).toThrow("REPAIR_WORKING_SET_TAMPERED");
    expect(() =>
      validateRepositoryRepairWorkingSet({
        proposal,
        journal,
        currentFiles: { ...valid, "src/b.ts": "premature edit\n" },
      }),
    ).toThrow("REPAIR_WORKING_SET_TAMPERED");
  });

  it("extends only the model idle deadline when response activity continues", () => {
    const proposal = createRepositoryRepairProposal(input);
    const initial = createRepositoryRepairIdleDeadline(proposal, 1_000);
    const afterActivity = createRepositoryRepairIdleDeadline(proposal, 500_000);

    expect(initial).toBe(601_000);
    expect(afterActivity).toBe(1_100_000);
    expect(afterActivity).toBeGreaterThan(initial);
    expect(() => createRepositoryRepairIdleDeadline(proposal, -1)).toThrow();

    const source = readFileSync("scripts/runtime/iris-repository-repair-worker.mjs", "utf8");
    expect(source).toContain("resetIdleTimer");
    expect(source).toContain("controller.abort()");
    expect(source).toContain("createRepositoryRepairIdleDeadline");
    expect(source).toContain("MODEL_IDLE_TIMEOUT");
  });

  it("attests completed cleanup only after candidate removal succeeds", () => {
    const source = readFileSync("scripts/runtime/iris-repository-repair-worker.mjs", "utf8");
    const payloadIndex = source.lastIndexOf("repositoryRepairResultPayloadSchema.parse");
    const cleanupIndex = source.lastIndexOf(
      "await cleanupCandidate(sourceRoot, candidateRoot, journalPath)",
    );
    const resultIndex = source.lastIndexOf("repositoryRepairResultSchema.parse");

    expect(payloadIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(payloadIndex);
    expect(cleanupIndex).toBeGreaterThan(-1);
    expect(resultIndex).toBeGreaterThan(cleanupIndex);
    expect(source).not.toContain(
      "await cleanupCandidate(sourceRoot, candidateRoot, journalPath).catch(() => undefined)",
    );
    expect(assertRepositoryRepairCleanupState(false, false)).toBe("completed");
    expect(() => assertRepositoryRepairCleanupState(true, false)).toThrow("REPAIR_CLEANUP_FAILED");
    expect(() => assertRepositoryRepairCleanupState(false, true)).toThrow("REPAIR_CLEANUP_FAILED");

    expect(() =>
      repositoryRepairResultPayloadSchema.parse({
        verdict: "verified",
        summary: "x".repeat(8_001),
        repository: "stoic1712-IRIS/IRIS",
        baseRevision: "a".repeat(40),
        candidateId: "candidate_release-seven-aaaaaaaaaaaa",
        diffDigest: `sha256:${"b".repeat(64)}`,
        changedFiles: [
          {
            path: "src/a.ts",
            beforeDigest: `sha256:${"c".repeat(64)}`,
            afterDigest: `sha256:${"d".repeat(64)}`,
          },
        ],
        diff: "diff",
        verification: [],
        canonicalRepositoryChanged: false,
        githubChanged: false,
        expiresAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
