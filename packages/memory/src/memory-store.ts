import { createHash } from "node:crypto";

import {
  provenanceSchema,
  sensitivitySchema,
  timestampSchema,
  type Provenance,
  type Sensitivity,
} from "@stoic-iris/contracts";
import { z } from "zod";

export const memoryCategories = [
  "founder",
  "project",
  "operational",
  "knowledge",
  "capability",
  "model",
  "audit",
] as const;
export type MemoryCategory = (typeof memoryCategories)[number];
const memoryCategorySchema = z.enum(memoryCategories);
const memoryIdSchema = z.string().regex(/^memory_[0-9a-f-]{36}$/);

export const memoryProposalSchema = z
  .object({
    memoryId: memoryIdSchema,
    category: memoryCategorySchema,
    key: z.string().min(1).max(500),
    value: z.string().min(1).max(100_000),
    sensitivity: sensitivitySchema,
    confidence: z.number().min(0).max(1),
    citations: z.array(z.string().min(1).max(2000)).min(1),
    proposedAt: timestampSchema,
    freshnessExpiresAt: timestampSchema.optional(),
    provenance: provenanceSchema,
    supersedesMemoryId: memoryIdSchema.optional(),
  })
  .strict();
export type MemoryProposal = z.infer<typeof memoryProposalSchema>;

export interface MemoryRecord extends MemoryProposal {
  state: "proposed" | "canonical" | "superseded" | "deleted";
  contentDigest: string;
  activatedAt?: string;
  supersededAt?: string;
}

export interface MemoryActivation {
  memoryId: string;
  contentDigest: string;
  authorizedBy: string;
  authorizedAt: string;
}

export interface MemoryAccess {
  principalId: string;
  categories: MemoryCategory[];
  maximumSensitivity: Sensitivity;
}

export interface MemoryQuery {
  category?: MemoryCategory;
  keyPrefix?: string;
  includeStale?: boolean;
  evaluatedAt: string;
}

export interface MemoryConflict {
  proposedMemoryId: string;
  canonicalMemoryId: string;
  category: MemoryCategory;
  key: string;
  reason: string;
}

const sensitivityRank: Record<Sensitivity, number> = {
  public: 0,
  internal: 1,
  sensitive: 2,
  secret: 3,
  "recovery-authority": 4,
};

export function memoryContentDigest(proposal: MemoryProposal): string {
  const canonical = JSON.stringify({
    category: proposal.category,
    key: proposal.key,
    value: proposal.value,
    citations: [...proposal.citations].sort(),
    provenance: proposal.provenance,
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export class GovernedMemoryStore {
  readonly #records = new Map<string, MemoryRecord>();

  propose(input: MemoryProposal): { record: MemoryRecord; conflicts: MemoryConflict[] } {
    const proposal = memoryProposalSchema.parse(input);
    if (this.#records.has(proposal.memoryId)) throw new Error("Memory identifier already exists.");
    const record: MemoryRecord = {
      ...structuredClone(proposal),
      state: "proposed",
      contentDigest: memoryContentDigest(proposal),
    };
    const conflicts = [...this.#records.values()]
      .filter(
        (candidate) =>
          candidate.state === "canonical" &&
          candidate.category === proposal.category &&
          candidate.key === proposal.key &&
          candidate.contentDigest !== record.contentDigest,
      )
      .map((candidate) => ({
        proposedMemoryId: record.memoryId,
        canonicalMemoryId: candidate.memoryId,
        category: proposal.category,
        key: proposal.key,
        reason: "A different canonical value already exists for this category and key.",
      }));
    this.#records.set(record.memoryId, record);
    return { record: structuredClone(record), conflicts };
  }

  activate(activation: MemoryActivation): MemoryRecord {
    const record = this.#records.get(activation.memoryId);
    if (record?.state !== "proposed") throw new Error("Only a proposed memory may be activated.");
    if (activation.contentDigest !== record.contentDigest)
      throw new Error("Activation digest does not match the proposed memory.");
    if (activation.authorizedBy.length === 0) throw new Error("Activation requires an authority.");
    timestampSchema.parse(activation.authorizedAt);
    const existing = [...this.#records.values()].find(
      (candidate) =>
        candidate.state === "canonical" &&
        candidate.category === record.category &&
        candidate.key === record.key,
    );
    if (existing !== undefined && record.supersedesMemoryId !== existing.memoryId)
      throw new Error("Conflicting canonical memory requires explicit supersession.");
    if (existing !== undefined) {
      existing.state = "superseded";
      existing.supersededAt = activation.authorizedAt;
    }
    record.state = "canonical";
    record.activatedAt = activation.authorizedAt;
    return structuredClone(record);
  }

  query(query: MemoryQuery, access: MemoryAccess): MemoryRecord[] {
    timestampSchema.parse(query.evaluatedAt);
    return [...this.#records.values()]
      .filter((record) => record.state === "canonical")
      .filter((record) => access.categories.includes(record.category))
      .filter(
        (record) =>
          sensitivityRank[record.sensitivity] <= sensitivityRank[access.maximumSensitivity],
      )
      .filter((record) => query.category === undefined || record.category === query.category)
      .filter((record) => query.keyPrefix === undefined || record.key.startsWith(query.keyPrefix))
      .filter(
        (record) =>
          query.includeStale === true ||
          record.freshnessExpiresAt === undefined ||
          Date.parse(record.freshnessExpiresAt) >= Date.parse(query.evaluatedAt),
      )
      .map((record) => structuredClone(record));
  }

  get(memoryId: string): MemoryRecord | undefined {
    const record = this.#records.get(memoryId);
    return record === undefined ? undefined : structuredClone(record);
  }
}

export function memoryProvenance(input: Provenance): Provenance {
  return provenanceSchema.parse(input);
}
