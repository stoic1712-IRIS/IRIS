import { createHash } from "node:crypto";
import { z } from "zod";
import { workerSpecificationDigest, workerSpecificationSchema } from "./worker-contracts.js";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const codingWorkerAuthorizationSchema = z.strictObject({
  authorizationId: z.string().regex(/^coding_authorization_[a-f0-9]{12}$/u),
  workerId: z.string().regex(/^worker_[a-z0-9][a-z0-9-]{2,99}$/u),
  workerDigest: digest,
  writePaths: z.array(z.string()).min(1).max(20),
  commands: z.array(z.array(z.string()).min(1)).min(1).max(20),
  maximumChangedLines: z.number().int().min(1).max(2_000),
  maximumCostUsd: z.literal(0),
  canonicalWriteAuthority: z.literal(false),
  providerAuthority: z.literal(false),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  approvalStatement: z.string().min(1),
});
export type CodingWorkerAuthorization = z.infer<typeof codingWorkerAuthorizationSchema>;

export function createCodingWorkerAuthorization(
  specificationInput: unknown,
  commands: string[][],
  now = new Date(),
): CodingWorkerAuthorization {
  const specification = workerSpecificationSchema.parse(specificationInput);
  if (specification.workerClass !== "coding" || specification.permissions.writePaths.length === 0)
    throw new Error("CODING_SCOPE_DENIED");
  const workerDigest = workerSpecificationDigest(specification);
  const seed = createHash("sha256")
    .update(
      JSON.stringify({ workerDigest, writePaths: specification.permissions.writePaths, commands }),
    )
    .digest("hex");
  const authorizationId = `coding_authorization_${seed.slice(0, 12)}`;
  return codingWorkerAuthorizationSchema.parse({
    authorizationId,
    workerId: specification.workerId,
    workerDigest,
    writePaths: specification.permissions.writePaths,
    commands,
    maximumChangedLines: 2_000,
    maximumCostUsd: 0,
    canonicalWriteAuthority: false,
    providerAuthority: false,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 120_000).toISOString(),
    approvalStatement: `I approve coding worker ${specification.workerId} at ${workerDigest} for one disposable execution exactly as proposed.`,
  });
}

export function verifyCodingWorkerAuthorization(input: {
  specification: unknown;
  authorization: unknown;
  typedStatement: string;
  now?: Date;
}): boolean {
  const specification = workerSpecificationSchema.parse(input.specification);
  const authorization = codingWorkerAuthorizationSchema.parse(input.authorization);
  return (
    specification.workerClass === "coding" &&
    authorization.workerId === specification.workerId &&
    authorization.workerDigest === workerSpecificationDigest(specification) &&
    input.typedStatement === authorization.approvalStatement &&
    (input.now ?? new Date()).getTime() < Date.parse(authorization.expiresAt) &&
    JSON.stringify(authorization.writePaths) ===
      JSON.stringify(specification.permissions.writePaths)
  );
}
