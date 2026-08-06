import { describe, expect, it } from "vitest";

import {
  LiveWorkerSupervisor,
  standingWorkerGrantSchema,
  type LiveWorkerExecutor,
} from "../packages/workers/src/index.js";

const grant = {
  grantId: "grant_live-research-0001",
  tools: ["research.search" as const],
  maximumSteps: 4,
  timeoutMs: 60_000,
  expiresAt: "2026-08-06T22:00:00.000Z",
  budgetUsd: 0 as const,
  externalMutation: false as const,
  mayExpand: false as const,
};

function ids() {
  let value = 0;
  return (kind: "worker" | "event") => `${kind}_live-test-${String(++value).padStart(4, "0")}`;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Cycle Seven live worker operations", () => {
  it("runs one bounded worker through a verified event chain", async () => {
    const executor: LiveWorkerExecutor = {
      execute: (_worker, _signal, progress) => {
        progress("executing", "Gathering bounded evidence.");
        return Promise.resolve({
          model: "gpt-oss:20b",
          summary: "The research run completed.",
          deliverable: "Evidence-backed findings.",
          requiresApproval: false,
        });
      },
    };
    const supervisor = new LiveWorkerSupervisor({
      executor,
      now: () => new Date("2026-08-06T21:00:00.000Z"),
      id: ids(),
    });
    const worker = supervisor.activate({
      kind: "evidence-research",
      objective: "Compare two documented local runtime approaches.",
      grant,
    });
    await settle();

    expect(supervisor.worker(worker.workerId)).toMatchObject({
      state: "completed",
      model: "gpt-oss:20b",
      requiresApproval: false,
    });
    expect(supervisor.events().map((event) => event.type)).toEqual([
      "activated",
      "state-changed",
      "progress",
      "state-changed",
      "completed",
    ]);
    expect(supervisor.verifyEventChain()).toBe(true);
  });

  it("pauses, resumes, stops, and steers without expanding a grant", async () => {
    let release: (() => void) | undefined;
    const executor: LiveWorkerExecutor = {
      execute: (_worker, signal, progress) =>
        new Promise((resolve, reject) => {
          progress("executing", "Working inside the standing grant.");
          release = () => {
            resolve({
              model: "qwen3-coder:30b",
              summary: "Completed after steering.",
              deliverable: "A bounded implementation plan.",
              requiresApproval: true,
            });
          };
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    };
    const supervisor = new LiveWorkerSupervisor({
      executor,
      now: () => new Date("2026-08-06T21:00:00.000Z"),
      id: ids(),
    });
    const first = supervisor.activate({
      kind: "complex-coding",
      objective: "Prepare a bounded TypeScript implementation plan.",
      grant: { ...grant, tools: ["filesystem.read" as const] },
    });
    await settle();
    expect(supervisor.pause(first.workerId).state).toBe("paused");
    expect(supervisor.steer(first.workerId, "Prioritize deterministic tests.").steering).toEqual([
      "Prioritize deterministic tests.",
    ]);
    expect(supervisor.resume(first.workerId).state).toBe("queued");
    await settle();
    release?.();
    await settle();
    expect(supervisor.worker(first.workerId)?.state).toBe("completed");

    const second = supervisor.activate({
      kind: "learning-tutor",
      objective: "Explain the repository boundary using a simple example.",
      grant: { ...grant, tools: [] },
    });
    await settle();
    expect(supervisor.stop(second.workerId).state).toBe("stopped");
    expect(supervisor.verifyEventChain()).toBe(true);
  });

  it("rejects expired, mutating, or expanded standing grants", () => {
    expect(() => standingWorkerGrantSchema.parse({ ...grant, budgetUsd: 1 })).toThrow();
    expect(() => standingWorkerGrantSchema.parse({ ...grant, externalMutation: true })).toThrow();
    expect(() => standingWorkerGrantSchema.parse({ ...grant, mayExpand: true })).toThrow();
    const supervisor = new LiveWorkerSupervisor({
      executor: {
        execute: () =>
          Promise.resolve({
            model: "qwen3:8b",
            summary: "unused",
            deliverable: "unused",
            requiresApproval: false,
          }),
      },
      now: () => new Date("2026-08-06T23:00:00.000Z"),
      id: ids(),
    });
    expect(() =>
      supervisor.activate({
        kind: "evidence-research",
        objective: "Research one exact documented comparison.",
        grant,
      }),
    ).toThrow("LIVE_WORKER_GRANT_EXPIRED");
  });
});
