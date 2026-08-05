import { describe, expect, it } from "vitest";
import {
  bindRepositoryReviewCode,
  createRepositoryReviewProposal,
  repositoryReviewResultSchema,
  validateRepositoryReviewResult,
  verifyRepositoryReviewApproval,
} from "../packages/kernel/src/index.js";
const input = {
  repository: "stoic1712-IRIS/IRIS" as const,
  baseRevision: "a".repeat(40),
  headRevision: "b".repeat(40),
  mergeBaseRevision: "a".repeat(40),
  diffDigest: `sha256:${"c".repeat(64)}`,
  changedFiles: ["src/example.ts"],
  model: "qwen3:8b" as const,
  maximumInputBytes: 1_048_576 as const,
  maximumOutputBytes: 65_536 as const,
  timeoutSeconds: 120 as const,
  writeAuthority: false as const,
  githubAuthority: false as const,
};
describe("Release Six repository review", () => {
  it("binds immutable zero-authority review inputs", () => {
    const now = new Date("2026-08-05T22:00:00Z");
    expect(createRepositoryReviewProposal(input, now)).toEqual(
      createRepositoryReviewProposal(input, now),
    );
  });
  it("rejects invented result fields", () => {
    expect(() =>
      repositoryReviewResultSchema.parse({
        verdict: "pass",
        summary: "ok",
        findings: [],
        approved: true,
      }),
    ).toThrow();
  });
  it("denies invented files, unsupported lines, and duplicate findings", () => {
    const finding = {
      severity: "high" as const,
      confidence: 0.9,
      claim: "A concrete defect",
      file: "src/example.ts",
      line: 12,
      evidence: "The changed line returns the wrong value.",
      remediation: "Return the expected value.",
    };
    const result = { verdict: "block" as const, summary: "Defect found.", findings: [finding] };
    expect(
      validateRepositoryReviewResult(result, input.changedFiles, { "src/example.ts": [12] }),
    ).toEqual(result);
    expect(() =>
      validateRepositoryReviewResult(
        { ...result, findings: [{ ...finding, file: "src/invented.ts" }] },
        input.changedFiles,
        { "src/example.ts": [12] },
      ),
    ).toThrow("CITATION_FILE_DENIED");
    expect(() =>
      validateRepositoryReviewResult(result, input.changedFiles, { "src/example.ts": [13] }),
    ).toThrow("CITATION_LINE_DENIED");
    expect(() =>
      validateRepositoryReviewResult(
        { ...result, findings: [finding, finding] },
        input.changedFiles,
        { "src/example.ts": [12] },
      ),
    ).toThrow("DUPLICATE_FINDING");
  });
  it("requires exact one-time approval material", () => {
    const now = new Date("2026-08-05T22:00:00Z"),
      proposal = createRepositoryReviewProposal(input, now),
      secret = "a".repeat(64),
      code = "12345678",
      expectedCodeBinding = bindRepositoryReviewCode(secret, proposal, code);
    expect(
      verifyRepositoryReviewApproval({
        proposal,
        statement: proposal.approvalStatement,
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now,
      }),
    ).toBe(true);
    expect(
      verifyRepositoryReviewApproval({
        proposal,
        statement: proposal.approvalStatement + " ",
        code,
        expectedCodeBinding,
        bindingSecret: secret,
        now,
      }),
    ).toBe(false);
  });
});
