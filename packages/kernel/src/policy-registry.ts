import { createHash } from "node:crypto";

import { z } from "zod";

import {
  authorizationDecisionSchema,
  canonicalIdSchema,
  protectedActionTypeSchema,
  riskClassSchema,
  semanticVersionSchema,
  sha256DigestSchema,
  type AuthorizationDecision,
  type RiskClass,
} from "@stoic-iris/contracts";

import { actorIdentityContextSchema } from "./identity.js";
import { objectiveClassificationSchema } from "./objective-intake.js";

export const policyRuleSchema = z
  .object({
    policyId: canonicalIdSchema.refine(
      (value) => value.startsWith("policy_"),
      "Expected a policy identifier.",
    ),
    version: semanticVersionSchema,
    riskClass: riskClassSchema,
    effect: z.enum(["allow", "require-approval", "deny"]),
    reason: z.string().min(1).max(1000),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.riskClass === "R4" && rule.effect !== "deny") {
      context.addIssue({
        code: "custom",
        message: "R4 policy rules must deny.",
        path: ["effect"],
      });
    }
  });
export type PolicyRule = z.infer<typeof policyRuleSchema>;

export class PolicyRegistry {
  readonly #rules = new Map<RiskClass, PolicyRule>();

  constructor(rules: PolicyRule[]) {
    for (const candidate of rules) {
      const rule = policyRuleSchema.parse(candidate);
      if (this.#rules.has(rule.riskClass)) {
        throw new Error(`A policy rule already exists for ${rule.riskClass}.`);
      }
      this.#rules.set(rule.riskClass, structuredClone(rule));
    }
  }

  find(riskClass: RiskClass): PolicyRule {
    const rule = this.#rules.get(riskClass);
    if (rule === undefined) throw new Error(`No policy rule exists for ${riskClass}.`);
    return structuredClone(rule);
  }

  list(): PolicyRule[] {
    return [...this.#rules.values()].map((rule) => structuredClone(rule));
  }
}

const policyId = (suffix: string): `policy_${string}` => `policy_01936f3a-8b5c-7def-8abc-${suffix}`;

export function createCanonicalPolicyRegistry(): PolicyRegistry {
  return new PolicyRegistry([
    {
      policyId: policyId("0000000000a0"),
      version: "1.0.0",
      riskClass: "R0",
      effect: "allow",
      reason: "Read-only work may proceed within authenticated read authority.",
    },
    {
      policyId: policyId("0000000000a1"),
      version: "1.0.0",
      riskClass: "R1",
      effect: "require-approval",
      reason: "A reversible local change requires explicit bounded task approval.",
    },
    {
      policyId: policyId("0000000000a2"),
      version: "1.0.0",
      riskClass: "R2",
      effect: "require-approval",
      reason: "A material change requires an exact proposal and explicit approval.",
    },
    {
      policyId: policyId("0000000000a3"),
      version: "1.0.0",
      riskClass: "R3",
      effect: "require-approval",
      reason: "A protected action requires authenticated typed approval.",
    },
    {
      policyId: policyId("0000000000a4"),
      version: "1.0.0",
      riskClass: "R4",
      effect: "deny",
      reason: "Constitutionally prohibited behavior is denied.",
    },
  ]);
}

export const permissionEvaluationRequestSchema = z
  .object({
    actor: actorIdentityContextSchema,
    classification: objectiveClassificationSchema,
    protectedAction: protectedActionTypeSchema.optional(),
    proposalPayload: z.string().min(1).optional(),
    proposalDigest: sha256DigestSchema.optional(),
  })
  .strict();
export type PermissionEvaluationRequest = z.infer<typeof permissionEvaluationRequestSchema>;

const expectedRequirement: Record<RiskClass, string> = {
  R0: "existing-read-authority",
  R1: "explicit-task-approval",
  R2: "explicit-task-approval",
  R3: "typed-protected-approval",
  R4: "deny",
};

export function calculateProposalDigest(payload: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}

export function verifyProposalDigest(payload: string, expectedDigest: string): boolean {
  const digest = sha256DigestSchema.parse(expectedDigest);
  return calculateProposalDigest(payload) === digest;
}

export function detectPolicyContradictions(request: PermissionEvaluationRequest): string[] {
  const input = permissionEvaluationRequestSchema.parse(request);
  const contradictions: string[] = [];
  const riskClass = input.classification.riskClass;

  if (input.classification.authorizationRequirement !== expectedRequirement[riskClass]) {
    contradictions.push("Authorization requirement contradicts the classified risk.");
  }
  if (riskClass === "R0" && input.protectedAction !== undefined) {
    contradictions.push("A read-only classification cannot request a protected action.");
  }
  if (riskClass === "R3" && input.protectedAction === undefined) {
    contradictions.push("An R3 evaluation requires an exact protected action type.");
  }
  if (riskClass === "R2" || riskClass === "R3") {
    if (input.proposalPayload === undefined || input.proposalDigest === undefined) {
      contradictions.push("R2 and R3 evaluations require a digest-bound proposal payload.");
    } else if (!verifyProposalDigest(input.proposalPayload, input.proposalDigest)) {
      contradictions.push("Proposal payload does not match its bound digest.");
    }
  }
  return contradictions;
}

const requiredActorScope: Partial<Record<RiskClass, "read" | "local-change" | "propose">> = {
  R0: "read",
  R1: "local-change",
  R2: "propose",
  R3: "propose",
};

export function evaluatePermission(
  registry: PolicyRegistry,
  request: PermissionEvaluationRequest,
): AuthorizationDecision {
  const input = permissionEvaluationRequestSchema.parse(request);
  const contradictions = detectPolicyContradictions(input);
  const rule = registry.find(input.classification.riskClass);
  const reasons = [...contradictions];

  if (!input.actor.authenticated) reasons.push("Actor identity is not authenticated.");
  const requiredScope = requiredActorScope[input.classification.riskClass];
  if (requiredScope !== undefined && !input.actor.authorityScopes.includes(requiredScope)) {
    reasons.push(`Actor lacks the required ${requiredScope} scope.`);
  }
  if (reasons.length > 0 || rule.effect === "deny") {
    return authorizationDecisionSchema.parse({
      decision: "deny",
      riskClass: input.classification.riskClass,
      reasons: reasons.length > 0 ? reasons : [rule.reason],
    });
  }
  return authorizationDecisionSchema.parse({
    decision: rule.effect,
    riskClass: input.classification.riskClass,
    reasons: [rule.reason],
  });
}
