import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  compileOperatingContract,
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

  it("binds every declared source to its current bytes", () => {
    const contract = irisOperatingContractSchema.parse(
      readJson("config/iris-operating-contract.v1.json"),
    );

    for (const source of contract.sources) {
      const digest = `sha256:${createHash("sha256")
        .update(readFileSync(source.path))
        .digest("hex")}`;
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
});
