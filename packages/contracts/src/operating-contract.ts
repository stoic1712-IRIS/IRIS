import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { z } from "zod";

import { sha256DigestSchema } from "./primitives.js";

export const operatingDecisionKindSchema = z.enum([
  "execute-now",
  "acquire-capability",
  "request-protected-approval",
  "repair-runtime",
  "report-terminal",
]);
export type OperatingDecisionKind = z.infer<typeof operatingDecisionKindSchema>;

export const operatingActorOwnershipSchema = z
  .object({
    identity: z.literal("iris-core"),
    policy: z.literal("iris-core"),
    authority: z.literal("iris-core"),
    approval: z.literal("founder"),
    execution: z.literal("iris-controller"),
    modelAuthority: z.literal("none"),
    evidence: z.literal("iris-core"),
    presentation: z.literal("iris"),
  })
  .strict();

const capabilityNameSchema = z.string().regex(/^[a-z][a-z0-9.-]+$/u);
const sourcePathSchema = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => !value.includes("\\") && !value.startsWith("/") && !value.includes(".."), {
    message: "Contract sources must be repository-relative POSIX paths.",
  });

const irisOperatingContractObjectSchema = z
  .object({
    contract: z.literal("iris.stoic/operating-contract/v1"),
    version: z.literal("1.0.0"),
    authorityOrder: z.tuple([
      z.literal("explicit-founder-instruction"),
      z.literal("canonical-operating-contract"),
      z.literal("contract-bound-canonical-sources"),
      z.literal("verified-live-state"),
      z.literal("supporting-context"),
    ]),
    ownership: operatingActorOwnershipSchema,
    ordinaryCapabilities: z.array(capabilityNameSchema).min(1),
    protectedEffects: z.array(capabilityNameSchema).min(1),
    decisionOutcomes: z.tuple([
      z.literal("execute-now"),
      z.literal("acquire-capability"),
      z.literal("request-protected-approval"),
      z.literal("repair-runtime"),
      z.literal("report-terminal"),
    ]),
    founderAccess: z
      .object({
        lifecycle: z.literal("session-bound"),
        invalidatedBy: z.tuple([
          z.literal("logout"),
          z.literal("revocation"),
          z.literal("emergency-stop"),
          z.literal("session-invalidation"),
          z.literal("gateway-replacement"),
        ]),
      })
      .strict(),
    sources: z
      .array(
        z
          .object({
            path: sourcePathSchema,
            digest: sha256DigestSchema,
            role: z.enum(["origin", "governance", "architecture", "registry", "specification"]),
          })
          .strict(),
      )
      .min(1),
    legacyAliases: z.record(z.string().min(1).max(200), z.string().min(1).max(200)),
  })
  .strict();

function addUniquenessIssues(
  value: z.infer<typeof irisOperatingContractObjectSchema>,
  context: z.RefinementCtx,
): void {
  const ordinary = new Set(value.ordinaryCapabilities);
  if (ordinary.size !== value.ordinaryCapabilities.length)
    context.addIssue({
      code: "custom",
      path: ["ordinaryCapabilities"],
      message: "Ordinary capabilities must be unique.",
    });

  const protectedEffects = new Set(value.protectedEffects);
  if (protectedEffects.size !== value.protectedEffects.length)
    context.addIssue({
      code: "custom",
      path: ["protectedEffects"],
      message: "Protected effects must be unique.",
    });

  const overlap = value.ordinaryCapabilities.find((capability) => protectedEffects.has(capability));
  if (overlap !== undefined)
    context.addIssue({
      code: "custom",
      path: ["protectedEffects"],
      message: `Capability cannot be both ordinary and protected: ${overlap}`,
    });

  const sourcePaths = value.sources.map((source) => source.path);
  if (new Set(sourcePaths).size !== sourcePaths.length)
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Contract source paths must be unique.",
    });
}

export const irisOperatingContractSchema =
  irisOperatingContractObjectSchema.superRefine(addUniquenessIssues);
export type IrisOperatingContract = z.infer<typeof irisOperatingContractSchema>;

export const compiledIrisOperatingContractSchema = irisOperatingContractObjectSchema
  .extend({ contractDigest: sha256DigestSchema })
  .strict()
  .superRefine((value, context) => {
    addUniquenessIssues(value, context);
  });
export type CompiledIrisOperatingContract = z.infer<typeof compiledIrisOperatingContractSchema>;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  return value;
}

export function canonicalizeOperatingContract(input: unknown): string {
  return JSON.stringify(canonicalValue(irisOperatingContractSchema.parse(input)));
}

function digestBytes(value: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function compileOperatingContract(input: unknown): CompiledIrisOperatingContract {
  const contract = irisOperatingContractSchema.parse(input);
  return compiledIrisOperatingContractSchema.parse({
    ...contract,
    contractDigest: digestBytes(canonicalizeOperatingContract(contract)),
  });
}

export function loadCompiledOperatingContract(input: unknown): CompiledIrisOperatingContract {
  const raw =
    typeof input === "string" ? (JSON.parse(readFileSync(input, "utf8")) as unknown) : input;
  const compiled = compiledIrisOperatingContractSchema.parse(raw);
  const { contractDigest, ...contract } = compiled;
  const expected = compileOperatingContract(contract).contractDigest;
  if (contractDigest !== expected) throw new Error("OPERATING_CONTRACT_DIGEST_MISMATCH");
  return compiled;
}

export function verifyOperatingContractSources(
  contractInput: unknown,
  root = ".",
): readonly { path: string; digest: string }[] {
  const contract = irisOperatingContractSchema.parse(contractInput);
  return contract.sources.map((source) => {
    const digest = digestBytes(readFileSync(`${root}/${source.path}`));
    if (digest !== source.digest)
      throw new Error(`OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH:${source.path}`);
    return { path: source.path, digest };
  });
}

export function canonicalizeCompiledOperatingContract(input: unknown): string {
  const compiled = compiledIrisOperatingContractSchema.parse(input);
  return `${JSON.stringify(canonicalValue(compiled), null, 2)}\n`;
}
