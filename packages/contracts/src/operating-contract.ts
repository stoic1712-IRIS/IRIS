import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

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

export const operatingObjectiveIdSchema = z.string().regex(/^objective_[a-z0-9-]{8,100}$/u);
export const operatingCapabilityNameSchema = z.string().regex(/^[a-z][a-z0-9.-]+$/u);
export const operatingGrantIdSchema = z.string().regex(/^access_[a-z0-9-]{8,100}$/u);
export const operatingGapSchema = z
  .object({
    capability: operatingCapabilityNameSchema,
    type: z.string().min(1).max(200),
    evidence: z.array(z.string().min(1).max(2_000)).min(1).max(100),
  })
  .strict();

export const operatingControllerDecisionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("execute-now"),
      objectiveId: operatingObjectiveIdSchema,
      capabilities: z.array(operatingCapabilityNameSchema),
      grantId: operatingGrantIdSchema,
      nextAction: z.literal("dispatch-governed-controller"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("acquire-capability"),
      objectiveId: operatingObjectiveIdSchema,
      gap: operatingGapSchema,
      acquisitionRequired: z.literal(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("request-protected-approval"),
      objectiveId: operatingObjectiveIdSchema,
      effect: operatingCapabilityNameSchema,
      proposalRequired: z.literal(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("repair-runtime"),
      objectiveId: operatingObjectiveIdSchema,
      capability: operatingCapabilityNameSchema,
      gap: operatingGapSchema,
      repairRequired: z.literal(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("report-terminal"),
      objectiveId: operatingObjectiveIdSchema,
      terminalState: z.enum([
        "completed",
        "failed",
        "cancelled",
        "unsupported",
        "physically-impossible",
      ]),
      evidence: z.array(z.string().min(1).max(2_000)).min(1).max(100),
    })
    .strict(),
]);
export type OperatingControllerDecision = z.infer<typeof operatingControllerDecisionSchema>;

export function formatProtectedApprovalStatement(input: {
  effect: string;
  proposalId: string;
  proposalDigest: string;
}): string {
  return `I approve ${input.proposalId} at ${input.proposalDigest} for protected effect ${input.effect} exactly as proposed.`;
}

export const operatingProtectedApprovalSchema = z
  .object({
    effect: operatingCapabilityNameSchema,
    proposalId: z.string().regex(/^proposal_[a-z0-9-]{8,100}$/u),
    proposalDigest: sha256DigestSchema,
    exactStatement: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const controllerDispositionSchema = z
  .object({
    dispositionId: z.string().regex(/^disposition_[a-z0-9-]{8,100}$/u),
    contractDigest: sha256DigestSchema,
    decision: operatingControllerDecisionSchema,
    exactEvidence: z
      .array(
        z
          .object({
            reference: z.string().min(1).max(2_048),
            digest: sha256DigestSchema,
          })
          .strict(),
      )
      .max(100),
    protectedApproval: operatingProtectedApprovalSchema.nullable(),
    decisionDigest: sha256DigestSchema,
  })
  .strict()
  .superRefine((disposition, context) => {
    if (disposition.decision.kind === "request-protected-approval") {
      if (disposition.protectedApproval === null)
        context.addIssue({
          code: "custom",
          path: ["protectedApproval"],
          message: "CONTROLLER_PROTECTED_APPROVAL_REQUIRED",
        });
      else if (disposition.protectedApproval.effect !== disposition.decision.effect)
        context.addIssue({
          code: "custom",
          path: ["protectedApproval", "effect"],
          message: "CONTROLLER_PROTECTED_APPROVAL_EFFECT_MISMATCH",
        });
      else if (
        disposition.protectedApproval.exactStatement !==
        formatProtectedApprovalStatement(disposition.protectedApproval)
      )
        context.addIssue({
          code: "custom",
          path: ["protectedApproval", "exactStatement"],
          message: "CONTROLLER_PROTECTED_APPROVAL_STATEMENT_MISMATCH",
        });
    } else if (disposition.protectedApproval !== null)
      context.addIssue({
        code: "custom",
        path: ["protectedApproval"],
        message: "CONTROLLER_PROTECTED_APPROVAL_UNEXPECTED",
      });
  });
export type ControllerDisposition = z.infer<typeof controllerDispositionSchema>;

const capabilityNameSchema = operatingCapabilityNameSchema;
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

function dispositionDigest(input: {
  contractDigest: string;
  decision: OperatingControllerDecision;
  exactEvidence: ControllerDisposition["exactEvidence"];
  protectedApproval: ControllerDisposition["protectedApproval"];
}): string {
  return digestBytes(JSON.stringify(canonicalValue(input)));
}

export function createControllerDisposition(
  input: Omit<ControllerDisposition, "decisionDigest">,
): ControllerDisposition {
  const candidate = {
    ...input,
    decisionDigest: dispositionDigest({
      contractDigest: input.contractDigest,
      decision: input.decision,
      exactEvidence: input.exactEvidence,
      protectedApproval: input.protectedApproval,
    }),
  };
  return controllerDispositionSchema.parse(candidate);
}

export function verifyControllerDisposition(input: unknown): ControllerDisposition {
  const disposition = controllerDispositionSchema.parse(input);
  const expected = dispositionDigest({
    contractDigest: disposition.contractDigest,
    decision: disposition.decision,
    exactEvidence: disposition.exactEvidence,
    protectedApproval: disposition.protectedApproval,
  });
  if (disposition.decisionDigest !== expected)
    throw new Error("CONTROLLER_DISPOSITION_DIGEST_MISMATCH");
  return disposition;
}

export function compileOperatingContract(input: unknown): CompiledIrisOperatingContract {
  const contract = irisOperatingContractSchema.parse(input);
  return compiledIrisOperatingContractSchema.parse({
    ...contract,
    contractDigest: digestBytes(canonicalizeOperatingContract(contract)),
  });
}

export function loadCompiledOperatingContract(
  input: unknown,
  options: { sourceRoot?: string; verifySources?: boolean } = {},
): CompiledIrisOperatingContract {
  const raw =
    typeof input === "string" ? (JSON.parse(readFileSync(input, "utf8")) as unknown) : input;
  const compiled = compiledIrisOperatingContractSchema.parse(raw);
  const { contractDigest, ...contract } = compiled;
  const expected = compileOperatingContract(contract).contractDigest;
  if (contractDigest !== expected) throw new Error("OPERATING_CONTRACT_DIGEST_MISMATCH");
  const verifySources = options.verifySources ?? typeof input === "string";
  const sourceRoot =
    options.sourceRoot ??
    (typeof input === "string" ? dirname(dirname(resolve(input))) : undefined);
  if (verifySources) {
    if (sourceRoot === undefined) throw new Error("OPERATING_CONTRACT_SOURCE_ROOT_REQUIRED");
    verifyOperatingContractSources(contract, sourceRoot);
  }
  return compiled;
}

export function verifyOperatingContractSources(
  contractInput: unknown,
  root = ".",
): readonly { path: string; digest: string }[] {
  const contract = irisOperatingContractSchema.parse(contractInput);
  return contract.sources.map((source) => {
    const bytes = readFileSync(resolve(root, source.path));
    const rawDigest = digestBytes(bytes);
    const textExtensions = new Set([".json", ".md", ".toml", ".txt", ".yaml", ".yml"]);
    const digest =
      rawDigest === source.digest || !textExtensions.has(extname(source.path).toLowerCase())
        ? rawDigest
        : digestBytes(Buffer.from(bytes.toString("utf8").replace(/\r\n/gu, "\n"), "utf8"));
    if (digest !== source.digest)
      throw new Error(`OPERATING_CONTRACT_SOURCE_DIGEST_MISMATCH:${source.path}`);
    return { path: source.path, digest };
  });
}

export function canonicalizeCompiledOperatingContract(input: unknown): string {
  const compiled = compiledIrisOperatingContractSchema.parse(input);
  return `${JSON.stringify(canonicalValue(compiled), null, 2)}\n`;
}
