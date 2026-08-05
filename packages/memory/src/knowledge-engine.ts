import { createHash } from "node:crypto";

import { z } from "zod";

export interface KnowledgeChunk {
  chunkId: string;
  documentId: string;
  ordinal: number;
  text: string;
  sourceReference: string;
  contentDigest: string;
}

export interface DerivedEmbedding {
  embeddingId: string;
  chunkId: string;
  model: string;
  dimensions: number;
  vector: number[];
  sourceDigest: string;
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function chunkDocument(input: {
  documentId: string;
  text: string;
  sourceReference: string;
  maximumCharacters: number;
  id: (ordinal: number) => string;
}): KnowledgeChunk[] {
  z.number().int().min(50).max(10_000).parse(input.maximumCharacters);
  const paragraphs = input.text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > input.maximumCharacters)
      throw new Error("A paragraph exceeds the deterministic chunk limit.");
    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    if (candidate.length > input.maximumCharacters) {
      chunks.push(current);
      current = paragraph;
    } else current = candidate;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((text, ordinal) => ({
    chunkId: input.id(ordinal),
    documentId: input.documentId,
    ordinal,
    text,
    sourceReference: input.sourceReference,
    contentDigest: digest(text),
  }));
}

export class KnowledgeIndex {
  readonly #chunks = new Map<string, KnowledgeChunk>();
  readonly #embeddings = new Map<string, DerivedEmbedding>();

  ingest(chunks: KnowledgeChunk[]): void {
    for (const chunk of chunks) this.#chunks.set(chunk.chunkId, structuredClone(chunk));
  }

  replaceEmbeddings(
    model: string,
    vectors: { embeddingId: string; chunkId: string; vector: number[] }[],
  ): void {
    for (const [id, embedding] of this.#embeddings)
      if (embedding.model === model) this.#embeddings.delete(id);
    for (const item of vectors) {
      const chunk = this.#chunks.get(item.chunkId);
      if (chunk === undefined) throw new Error("Embedding source chunk does not exist.");
      if (item.vector.length === 0 || item.vector.some((value) => !Number.isFinite(value)))
        throw new Error("Embedding vector is invalid.");
      this.#embeddings.set(item.embeddingId, {
        ...structuredClone(item),
        model,
        dimensions: item.vector.length,
        sourceDigest: chunk.contentDigest,
      });
    }
  }

  searchText(query: string, limit: number): KnowledgeChunk[] {
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean);
    return [...this.#chunks.values()]
      .map((chunk) => ({
        chunk,
        score: terms.filter((term) => chunk.text.toLowerCase().includes(term)).length,
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score || left.chunk.ordinal - right.chunk.ordinal)
      .slice(0, limit)
      .map(({ chunk }) => structuredClone(chunk));
  }

  searchVector(vector: number[], model: string, limit: number, enabled = true): KnowledgeChunk[] {
    if (!enabled) return [];
    const cosine = (left: number[], right: number[]) => {
      if (left.length !== right.length) return Number.NEGATIVE_INFINITY;
      const dot = left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
      const magnitude = (values: number[]) =>
        Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
      return dot / (magnitude(left) * magnitude(right));
    };
    return [...this.#embeddings.values()]
      .filter((embedding) => embedding.model === model)
      .map((embedding) => ({ embedding, score: cosine(vector, embedding.vector) }))
      .sort(
        (left, right) =>
          right.score - left.score || left.embedding.chunkId.localeCompare(right.embedding.chunkId),
      )
      .slice(0, limit)
      .map(({ embedding }) => this.#chunks.get(embedding.chunkId))
      .filter((chunk): chunk is KnowledgeChunk => chunk !== undefined)
      .map((chunk) => structuredClone(chunk));
  }
}
