import { z } from "zod";

export const developmentCandidateSchema = z
  .object({
    candidateId: z.string().regex(/^candidate_[a-z0-9][a-z0-9-]{2,99}$/),
    title: z.string().min(1).max(300),
    capabilityReturn: z.number().int().min(0).max(10),
    reuseMultiplier: z.number().int().min(0).max(10),
    prerequisiteUnlocks: z.number().int().min(0).max(100),
    risk: z.number().int().min(0).max(10),
    effort: z.number().int().min(1).max(10),
    technicalDebtReduction: z.number().int().min(0).max(10),
    dependencies: z.array(z.string().min(1).max(200)),
    evidence: z.array(z.string().min(1).max(2_000)).min(1),
    domainSpecific: z.boolean(),
    strengthensIrisCore: z.boolean(),
  })
  .strict();
export type DevelopmentCandidate = z.infer<typeof developmentCandidateSchema>;

export interface DevelopmentRecommendation {
  candidateId: string;
  score: number;
  classification: "iris-core" | "layer-4";
  dependencies: string[];
  risks: string[];
  evidence: string[];
  rationale: string;
}

export function classifyDevelopment(candidate: DevelopmentCandidate): "iris-core" | "layer-4" {
  if (candidate.domainSpecific && !candidate.strengthensIrisCore) return "layer-4";
  return "iris-core";
}

export function recommendDevelopment(input: DevelopmentCandidate[]): DevelopmentRecommendation[] {
  const candidates = input.map((candidate) => developmentCandidateSchema.parse(candidate));
  const identifiers = new Set(candidates.map((candidate) => candidate.candidateId));
  if (identifiers.size !== candidates.length)
    throw new Error("Development candidate identifiers must be unique.");
  return candidates
    .map((candidate) => {
      const score =
        candidate.capabilityReturn * 4 +
        candidate.reuseMultiplier * 5 +
        candidate.prerequisiteUnlocks * 3 +
        candidate.technicalDebtReduction * 2 -
        candidate.risk * 2 -
        candidate.effort;
      return {
        candidateId: candidate.candidateId,
        score,
        classification: classifyDevelopment(candidate),
        dependencies: [...candidate.dependencies],
        risks:
          candidate.risk === 0
            ? []
            : [`Risk score ${String(candidate.risk)}/10 requires mitigation.`],
        evidence: [...candidate.evidence],
        rationale: `Score ${String(score)} prioritizes capability return, reuse, prerequisite unlocks, and debt reduction while subtracting risk and effort.`,
      } satisfies DevelopmentRecommendation;
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.candidateId.localeCompare(right.candidateId),
    );
}

export function founderOverride(input: {
  recommendations: DevelopmentRecommendation[];
  selectedCandidateId: string;
  actorType: "founder" | "iris-core" | "worker";
  rationale: string;
}): DevelopmentRecommendation[] {
  if (input.actorType !== "founder")
    throw new Error("Only the Founder may override strategic priority.");
  if (input.rationale.trim().length === 0) throw new Error("Founder override requires rationale.");
  const selected = input.recommendations.find(
    (recommendation) => recommendation.candidateId === input.selectedCandidateId,
  );
  if (selected === undefined) throw new Error("Founder-selected candidate does not exist.");
  return [
    structuredClone(selected),
    ...input.recommendations
      .filter((item) => item !== selected)
      .map((item) => structuredClone(item)),
  ];
}
