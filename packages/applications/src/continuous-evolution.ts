import {
  benchmarkResultSchema,
  digest,
  evolutionProposalSchema,
  researchIntakeSchema,
  type BenchmarkResult,
  type EvolutionProposal,
  type ResearchIntake,
} from "./contracts.js";

export class ContinuousEvolutionEngine {
  compare(input: {
    proposalId: string;
    category: EvolutionProposal["category"];
    subject: string;
    research: ResearchIntake[];
    benchmarks: BenchmarkResult[];
    recommendation: string;
    risks: string[];
    rollback: string;
  }): EvolutionProposal {
    const research = input.research.map((item) => researchIntakeSchema.parse(item));
    const benchmarks = input.benchmarks.map((item) => benchmarkResultSchema.parse(item));
    if (research.length === 0 && benchmarks.length === 0)
      throw new Error("Evolution proposals require research or benchmark evidence.");
    return evolutionProposalSchema.parse({
      proposalId: input.proposalId,
      category: input.category,
      subject: input.subject,
      evidenceDigests: [...research.map(digest), ...benchmarks.map(digest)],
      recommendation: input.recommendation,
      risks: input.risks,
      rollback: input.rollback,
      state: "pending-founder-approval",
      executionAuthorized: false,
    });
  }
}
