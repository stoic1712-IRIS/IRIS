import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileOperatingContract,
  createControllerDisposition,
  irisOperatingContractSchema,
  loadCompiledOperatingContract,
} from "../packages/contracts/src/operating-contract.js";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("canonical operating contract", () => {
  it("is strict, deterministic, complete, unique, and disjoint", () => {
    const source = readJson("config/iris-operating-contract.v1.json");
    const contract = irisOperatingContractSchema.parse(source);
    const first = compileOperatingContract(contract);
    const second = compileOperatingContract(JSON.parse(JSON.stringify(contract)) as unknown);

    expect(first).toEqual(second);
    expect(new Set(contract.ordinaryCapabilities).size).toBe(contract.ordinaryCapabilities.length);
    expect(new Set(contract.protectedEffects).size).toBe(contract.protectedEffects.length);
    expect(
      contract.ordinaryCapabilities.filter((value) => contract.protectedEffects.includes(value)),
    ).toEqual([]);
  });

  it("rejects extra fields, duplicates, overlap, and unknown decision outcomes", () => {
    const source = readJson("config/iris-operating-contract.v1.json") as Record<string, unknown>;
    const ordinary = source.ordinaryCapabilities as string[];
    const protectedEffects = source.protectedEffects as string[];

    expect(() => irisOperatingContractSchema.parse({ ...source, extra: true })).toThrow();
    expect(() =>
      irisOperatingContractSchema.parse({
        ...source,
        decisionOutcomes: ["execute-now", "ignore-policy"],
      }),
    ).toThrow();
    expect(() =>
      irisOperatingContractSchema.parse({
        ...source,
        ordinaryCapabilities: [...ordinary, ordinary[0]],
      }),
    ).toThrow();
    expect(() =>
      irisOperatingContractSchema.parse({
        ...source,
        protectedEffects: [...protectedEffects, ordinary[0]],
      }),
    ).toThrow();
  });

  it("binds every declared source to its canonical text content", () => {
    const contract = irisOperatingContractSchema.parse(
      readJson("config/iris-operating-contract.v1.json"),
    );

    for (const source of contract.sources) {
      const canonicalText = readFileSync(source.path, "utf8").replace(/\r\n/gu, "\n");
      const digest = `sha256:${createHash("sha256").update(canonicalText).digest("hex")}`;
      expect(digest, source.path).toBe(source.digest);
    }
  });

  it("loads the checked-in compiled artifact and rejects digest tampering", () => {
    const compiled = loadCompiledOperatingContract(
      "generated/iris-operating-contract.compiled.json",
    );
    expect(compiled.contract).toBe("iris.stoic/operating-contract/v1");

    expect(() =>
      loadCompiledOperatingContract({ ...compiled, contractDigest: `sha256:${"0".repeat(64)}` }),
    ).toThrow("OPERATING_CONTRACT_DIGEST_MISMATCH");
  });

  it("fails closed when a source bound by the compiled artifact drifts", () => {
    const compiled = loadCompiledOperatingContract(
      "generated/iris-operating-contract.compiled.json",
    );
    const fixtureRoot = mkdtempSync(join(tmpdir(), "iris-contract-source-drift-"));
    try {
      const compiledPath = join(fixtureRoot, "generated", "iris-operating-contract.compiled.json");
      mkdirSync(dirname(compiledPath), { recursive: true });
      writeFileSync(compiledPath, JSON.stringify(compiled), "utf8");
      for (const source of compiled.sources) {
        const target = join(fixtureRoot, source.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, readFileSync(source.path));
      }
      const [drifted] = compiled.sources;
      if (drifted === undefined) throw new Error("Expected one bound source.");
      writeFileSync(join(fixtureRoot, drifted.path), "drifted canonical bytes\n", "utf8");

      expect(() => loadCompiledOperatingContract(compiledPath)).toThrow(
        `OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH:${drifted.path}`,
      );
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("accepts canonical text sources checked out with Windows line endings", () => {
    const compiled = loadCompiledOperatingContract(
      readJson("generated/iris-operating-contract.compiled.json"),
    );
    const fixtureRoot = mkdtempSync(join(tmpdir(), "iris-contract-source-crlf-"));
    try {
      const compiledPath = join(fixtureRoot, "generated", "iris-operating-contract.compiled.json");
      mkdirSync(dirname(compiledPath), { recursive: true });
      writeFileSync(compiledPath, JSON.stringify(compiled), "utf8");
      for (const source of compiled.sources) {
        const target = join(fixtureRoot, source.path);
        mkdirSync(dirname(target), { recursive: true });
        const canonicalText = readFileSync(source.path, "utf8").replace(/\r\n/gu, "\n");
        writeFileSync(target, canonicalText.replace(/\n/gu, "\r\n"), "utf8");
      }

      expect(() => loadCompiledOperatingContract(compiledPath)).not.toThrow();
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("rejects protected approval wording that is not bound to its proposal digest", () => {
    const sha = (character: string) => `sha256:${character.repeat(64)}`;
    expect(() =>
      createControllerDisposition({
        dispositionId: "disposition_protected-approval-0001",
        contractDigest: sha("a"),
        decision: {
          kind: "request-protected-approval",
          objectiveId: "objective_protected-approval-0001",
          effect: "git.push",
          proposalRequired: true,
        },
        exactEvidence: [],
        protectedApproval: {
          effect: "git.push",
          proposalId: "proposal_protected-approval-0001",
          proposalDigest: sha("b"),
          exactStatement: "Approve it.",
        },
      }),
    ).toThrow("CONTROLLER_PROTECTED_APPROVAL_STATEMENT_MISMATCH");
  });
});
