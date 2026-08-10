import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertRepositoryRepairCheckoutContent,
  bindRepositoryRepairCode,
  createRepositoryRepairModelSchema,
  createRepositoryRepairProposal,
  formatRepositoryRepairModelDenial,
  repositoryRepairBootstrapCommand,
  repositoryRepairResultSchema,
  type RepositoryRepairProposal,
  validateRepositoryRepairCandidate,
  verifyRepositoryRepairApproval,
} from "../packages/kernel/src/index.js";

const input: Omit<
  RepositoryRepairProposal,
  "proposalId" | "digest" | "approvalStatement" | "createdAt" | "expiresAt"
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

  it("requires exact unexpired one-time approval material", () => {
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
    expect(
      verifyRepositoryRepairApproval({
        proposal,
        statement: proposal.approvalStatement,
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now: new Date("2026-08-05T22:09:59.999Z"),
      }),
    ).toBe(true);
    expect(proposal.expiresAt).toBe("2026-08-05T22:10:00.000Z");
    expect(
      verifyRepositoryRepairApproval({
        proposal,
        statement: proposal.approvalStatement,
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now: new Date("2026-08-05T22:10:00.000Z"),
      }),
    ).toBe(false);
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
});
