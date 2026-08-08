import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { z } from "zod";

import {
  executableWorkerApprovalSchema,
  executableWorkerCheckSchema,
  executableWorkerCleanupEvidenceSchema,
  executableWorkerProposalSchema,
  executableWorkerStateSchema,
} from "./executable-worker-contracts.js";
import type {
  ExecutableWorkerApproval,
  ExecutableWorkerCheck,
  ExecutableWorkerCleanupEvidence,
  ExecutableWorkerProposal,
} from "./executable-worker-contracts.js";
import { sha256Schema } from "./contracts.js";

export interface ExecutableWorkerWorkspace {
  id: string;
  path: string;
  baseRevision: string;
  disposable: true;
}

export interface ExecutableWorkerJournalEvent {
  sequence: number;
  type: string;
  state: string;
  summary: string;
  occurredAt: string;
  previousDigest?: string | undefined;
  digest: string;
}

export interface ExecutableWorkerAttemptEvidence {
  iteration: number;
  planDigest: string;
  normalizationChecks: ExecutableWorkerCheck[];
  verificationChecks: ExecutableWorkerCheck[];
  changedPaths: string[];
  diffDigest?: string | undefined;
  startedAt: string;
  completedAt?: string | undefined;
}

const executableWorkerAttemptEvidenceSchema = z
  .object({
    iteration: z.number().int().positive().max(5),
    planDigest: sha256Schema,
    normalizationChecks: z.array(executableWorkerCheckSchema).max(5),
    verificationChecks: z.array(executableWorkerCheckSchema).max(10),
    changedPaths: z.array(z.string().min(1).max(500)).max(50),
    diffDigest: sha256Schema.optional(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().optional(),
  })
  .strict();

const executableWorkerJournalSchema = z
  .object({
    journalVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    executionId: z.string().regex(/^execution_cycle8-[a-z0-9-]{8,100}$/u),
    proposal: executableWorkerProposalSchema,
    approval: executableWorkerApprovalSchema,
    approvalBindingDigest: sha256Schema.optional(),
    state: executableWorkerStateSchema,
    iteration: z.number().int().min(0).max(5),
    summary: z.string().min(1).max(10_000),
    workspace: z
      .object({
        id: z.string().min(1).max(200),
        path: z.string().min(1).max(2_000),
        baseRevision: z.string().regex(/^[a-f0-9]{40}$/u),
        disposable: z.literal(true),
      })
      .strict()
      .optional(),
    changedPaths: z.array(z.string().min(1).max(500)).max(50),
    materializationChecks: z.array(executableWorkerCheckSchema).max(3).default([]),
    baselineChecks: z.array(executableWorkerCheckSchema).max(10).default([]),
    attempts: z.array(executableWorkerAttemptEvidenceSchema).max(5).default([]),
    cleanup: executableWorkerCleanupEvidenceSchema.optional(),
    candidateCommit: z
      .string()
      .regex(/^[a-f0-9]{40}$/u)
      .optional(),
    candidateRef: z.string().min(1).max(300).optional(),
    events: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            type: z.string().min(1).max(200),
            state: executableWorkerStateSchema,
            summary: z.string().min(1).max(10_000),
            occurredAt: z.iso.datetime(),
            previousDigest: sha256Schema.optional(),
            digest: sha256Schema,
          })
          .strict(),
      )
      .max(100),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export interface ExecutableWorkerJournal {
  journalVersion: 1 | 2 | 3;
  executionId: string;
  proposal: ExecutableWorkerProposal;
  approval: ExecutableWorkerApproval;
  approvalBindingDigest?: string | undefined;
  state: z.infer<typeof executableWorkerStateSchema>;
  iteration: number;
  summary: string;
  workspace?: ExecutableWorkerWorkspace | undefined;
  changedPaths: string[];
  materializationChecks: ExecutableWorkerCheck[];
  baselineChecks: ExecutableWorkerCheck[];
  attempts: ExecutableWorkerAttemptEvidence[];
  cleanup?: ExecutableWorkerCleanupEvidence | undefined;
  candidateCommit?: string | undefined;
  candidateRef?: string | undefined;
  events: ExecutableWorkerJournalEvent[];
  updatedAt: string;
}

export interface ExecutionJournalStore {
  save(journal: ExecutableWorkerJournal): Promise<void>;
  load(executionId: string): Promise<ExecutableWorkerJournal | null>;
}

export class MemoryExecutionJournalStore implements ExecutionJournalStore {
  readonly #journals = new Map<string, ExecutableWorkerJournal>();

  save(journal: ExecutableWorkerJournal): Promise<void> {
    const validated = executableWorkerJournalSchema.parse(journal);
    this.#journals.set(journal.executionId, structuredClone(validated));
    return Promise.resolve();
  }

  load(executionId: string): Promise<ExecutableWorkerJournal | null> {
    const journal = this.#journals.get(executionId);
    return Promise.resolve(journal === undefined ? null : structuredClone(journal));
  }
}

export class FileExecutionJournalStore implements ExecutionJournalStore {
  readonly #directory: string;

  constructor(directory: string) {
    this.#directory = resolve(directory);
  }

  async save(journal: ExecutableWorkerJournal): Promise<void> {
    const validated = executableWorkerJournalSchema.parse(journal);
    const target = this.#target(journal.executionId);
    const temporary = `${target}.${String(process.pid)}.tmp`;
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  async load(executionId: string): Promise<ExecutableWorkerJournal | null> {
    try {
      return executableWorkerJournalSchema.parse(
        JSON.parse(await readFile(this.#target(executionId), "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  #target(executionId: string): string {
    if (!/^execution_cycle8-[a-z0-9-]{8,100}$/u.test(executionId))
      throw new Error("EXECUTABLE_WORKER_EXECUTION_ID_INVALID");
    return join(this.#directory, `${executionId}.json`);
  }
}
