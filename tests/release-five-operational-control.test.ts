import { describe, expect, it } from "vitest";
import {
  bindApprovalCode,
  createOperationalMissionProposal,
  verifyOperationalApproval,
} from "../packages/kernel/src/index.js";

const now = new Date("2026-08-05T21:00:00.000Z");

describe("Release Five operational control", () => {
  it("creates a stable zero-authority worker proposal", () => {
    const left = createOperationalMissionProposal("Assess IRIS readiness.", now);
    const right = createOperationalMissionProposal("Assess IRIS readiness.", now);
    expect(left).toEqual(right);
    expect(left.worker.writePaths).toEqual([]);
    expect(left.worker.tools).toEqual([]);
    expect(left.worker.maximumCostUsd).toBe(0);
  });

  it("requires the exact typed statement, code binding, and freshness", () => {
    const proposal = createOperationalMissionProposal("Assess IRIS readiness.", now);
    const secret = "a".repeat(64);
    const code = "12345678";
    const expectedCodeBinding = bindApprovalCode(secret, proposal, code);
    const base = {
      proposal,
      statement: proposal.approvalStatement,
      code,
      expectedCodeBinding,
      bindingSecret: secret,
      now,
    };
    expect(verifyOperationalApproval(base)).toBe(true);
    expect(verifyOperationalApproval({ ...base, statement: `${base.statement} ` })).toBe(false);
    expect(verifyOperationalApproval({ ...base, code: "87654321" })).toBe(false);
    expect(verifyOperationalApproval({ ...base, now: new Date(now.getTime() + 120_000) })).toBe(
      false,
    );
  });
});
