import { z } from "zod";

import { canonicalIdSchema, semanticVersionSchema, timestampSchema } from "@stoic-iris/contracts";

const identityIdSchema = canonicalIdSchema.refine(
  (value) => value.startsWith("identity_"),
  "Expected an identity identifier.",
);

export const authorityScopeSchema = z.enum([
  "read",
  "local-change",
  "propose",
  "approve-r2",
  "approve-r3",
  "identity-amendment",
]);
export type AuthorityScope = z.infer<typeof authorityScopeSchema>;

export const actorIdentityContextSchema = z
  .object({
    identityId: identityIdSchema,
    identityType: z.enum(["founder", "iris-core", "worker", "model", "tool"]),
    displayName: z.string().min(1).max(200),
    authenticated: z.boolean(),
    authorityScopes: z.array(authorityScopeSchema),
  })
  .strict()
  .superRefine((identity, context) => {
    const protectedScopes: AuthorityScope[] = ["approve-r2", "approve-r3", "identity-amendment"];
    if (
      identity.identityType !== "founder" &&
      identity.authorityScopes.some((scope) => protectedScopes.includes(scope))
    ) {
      context.addIssue({
        code: "custom",
        message: "Only the Founder identity may hold protected approval authority.",
        path: ["authorityScopes"],
      });
    }
    if (!identity.authenticated && identity.authorityScopes.length > 0) {
      context.addIssue({
        code: "custom",
        message: "An unauthenticated identity cannot hold authority scopes.",
        path: ["authorityScopes"],
      });
    }
  });
export type ActorIdentityContext = z.infer<typeof actorIdentityContextSchema>;

export const cognitiveIdentityRecordSchema = z
  .object({
    identityId: identityIdSchema,
    displayName: z.string().min(1).max(200),
    mission: z.string().min(1).max(4000),
    coreValues: z.array(z.string().min(1).max(500)).min(1),
    founderAuthority: z
      .object({
        founderIdentityId: identityIdSchema,
        protectedDecisionDomains: z.array(z.string().min(1).max(500)).min(1),
      })
      .strict(),
    constitutionalVersion: semanticVersionSchema,
    reasoningFrameworkVersion: semanticVersionSchema,
    memoryPolicyVersion: semanticVersionSchema,
    approvalPolicyVersion: semanticVersionSchema,
    voiceProfile: z.array(z.string().min(1).max(500)).min(1),
    prohibitedClaims: z.array(z.string().min(1).max(1000)).min(1),
    effectiveAt: timestampSchema,
    provenance: z.array(z.string().min(1).max(1000)).min(1),
  })
  .strict();
export type CognitiveIdentityRecord = z.infer<typeof cognitiveIdentityRecordSchema>;

export const reasoningProfileSchema = z
  .object({
    profileId: z.string().min(1).max(200),
    version: semanticVersionSchema,
    principles: z.array(z.string().min(1).max(500)).min(1),
    requiredEvidence: z.array(z.string().min(1).max(1000)),
    prohibitedBehaviors: z.array(z.string().min(1).max(1000)).min(1),
  })
  .strict();
export type ReasoningProfile = z.infer<typeof reasoningProfileSchema>;

export function hasFounderAuthority(
  identityRecord: CognitiveIdentityRecord,
  actor: ActorIdentityContext,
  requiredScope: "approve-r2" | "approve-r3" | "identity-amendment",
): boolean {
  const identity = cognitiveIdentityRecordSchema.parse(identityRecord);
  const candidate = actorIdentityContextSchema.parse(actor);
  return (
    candidate.authenticated &&
    candidate.identityType === "founder" &&
    candidate.identityId === identity.founderAuthority.founderIdentityId &&
    candidate.authorityScopes.includes(requiredScope)
  );
}
