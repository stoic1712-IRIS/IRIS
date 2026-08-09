import { describe, expect, it } from "vitest";

import type { ModelLeaseEvent } from "../packages/model-gateway/src/cognitive-turn-contracts.js";
import type { IrisModelName } from "../packages/model-gateway/src/model-router.js";
import {
  ModelLeaseScheduler,
  type ModelLease,
  type ModelLifecycleAdapter,
  type ModelLeaseJournal,
} from "../packages/model-gateway/src/model-lease-scheduler.js";

const requestId = "request_0198a6d0-07ca-7b32-a021-98b267ca44ef";
const fixedClock = () => "2026-08-08T21:39:25.124Z";

class RecordingLifecycle implements ModelLifecycleAdapter {
  active = 0;
  maximumConcurrent = 0;
  readonly released: IrisModelName[] = [];

  acquire(
    _requestId: string,
    model: IrisModelName,
    signal: AbortSignal,
  ): Promise<{ leaseId: string; acquiredAt: string }> {
    void signal;
    this.active += 1;
    this.maximumConcurrent = Math.max(this.maximumConcurrent, this.active);
    return Promise.resolve({ leaseId: `lease-${model}`, acquiredAt: fixedClock() });
  }

  release(
    lease: ModelLease,
    reason: "completed" | "failed" | "cancelled",
  ): Promise<{ releasedAt: string }> {
    void reason;
    this.released.push(lease.model);
    this.active -= 1;
    return Promise.resolve({ releasedAt: fixedClock() });
  }
}

class MemoryLeaseJournal implements ModelLeaseJournal {
  active: ModelLease | null = null;

  loadActive(): Promise<ModelLease | null> {
    return Promise.resolve(this.active);
  }

  append(event: ModelLeaseEvent): Promise<void> {
    if (event.type === "acquired") {
      this.active = {
        requestId: event.requestId,
        leaseId: event.leaseId,
        model: event.model,
        phase: event.phase,
        acquiredAt: event.occurredAt,
      };
    } else if (event.type === "released") {
      this.active = null;
    }
    return Promise.resolve();
  }
}

describe("ModelLeaseScheduler", () => {
  it("never overlaps Qwen, specialist, reviewer, and synthesis leases", async () => {
    const lifecycle = new RecordingLifecycle();
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock, new MemoryLeaseJournal());

    await scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-planning", () =>
      Promise.resolve("planned"),
    );
    await scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", () =>
      Promise.resolve("built"),
    );
    await scheduler.withLease(requestId, "gpt-oss:20b", "independent-review", () =>
      Promise.resolve("reviewed"),
    );
    await scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-synthesizing", () =>
      Promise.resolve("done"),
    );

    expect(lifecycle.maximumConcurrent).toBe(1);
    expect(scheduler.activeLease()).toBeNull();
    expect(lifecycle.released).toEqual([
      "qwen3.6:27b",
      "qwen3-coder:30b",
      "gpt-oss:20b",
      "qwen3.6:27b",
    ]);
  });

  it("refuses overlapping acquisition", async () => {
    const lifecycle = new RecordingLifecycle();
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock, new MemoryLeaseJournal());
    let releaseEffect!: () => void;
    const held = scheduler.withLease(
      requestId,
      "qwen3.6:27b",
      "orchestrator-planning",
      () =>
        new Promise<void>((resolve) => {
          releaseEffect = resolve;
        }),
    );
    await Promise.resolve();

    await expect(
      scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", () =>
        Promise.resolve(undefined),
      ),
    ).rejects.toThrow("MODEL_LEASE_CONFLICT");
    releaseEffect();
    await held;
    expect(lifecycle.maximumConcurrent).toBe(1);
  });

  it("aborts the active effect and still attempts release", async () => {
    const lifecycle = new RecordingLifecycle();
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock, new MemoryLeaseJournal());
    const running = scheduler.withLease(
      requestId,
      "qwen3.6:27b",
      "orchestrator-planning",
      (_lease, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new Error("aborted"));
            },
            { once: true },
          );
        }),
    );
    await Promise.resolve();

    await scheduler.cancel(requestId);
    await expect(running).rejects.toThrow("COGNITIVE_TURN_CANCELLED");
    expect(lifecycle.released).toEqual(["qwen3.6:27b"]);
    expect(scheduler.activeLease()).toBeNull();
    expect(scheduler.events().map((event) => event.type)).toEqual([
      "acquired",
      "cancelled",
      "release-requested",
      "released",
    ]);
  });

  it("poisons a failed release until provider-confirmed reconciliation", async () => {
    const lifecycle = new RecordingLifecycle();
    lifecycle.release = () => Promise.reject(new Error("provider refused release"));
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock, new MemoryLeaseJournal());

    await expect(
      scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-planning", () =>
        Promise.resolve("planned"),
      ),
    ).rejects.toThrow("MODEL_LEASE_RELEASE_FAILED");
    expect(scheduler.activeLease()?.model).toBe("qwen3.6:27b");
    expect(scheduler.events().at(-1)?.type).toBe("release-failed");
    await expect(
      scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", () =>
        Promise.resolve("unsafe"),
      ),
    ).rejects.toThrow("MODEL_LEASE_CONFLICT");

    lifecycle.release = (lease) => {
      lifecycle.released.push(lease.model);
      lifecycle.active -= 1;
      return Promise.resolve({ releasedAt: fixedClock() });
    };
    await scheduler.reconcileRelease();
    expect(scheduler.activeLease()).toBeNull();
    await expect(
      scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", () =>
        Promise.resolve("safe"),
      ),
    ).resolves.toBe("safe");
  });

  it("restores an active durable lease and requires reconciliation before new work", async () => {
    const lifecycle = new RecordingLifecycle();
    lifecycle.active = 1;
    const journal = new MemoryLeaseJournal();
    journal.active = {
      requestId,
      leaseId: "lease-restored",
      model: "qwen3.6:27b",
      phase: "orchestrator-planning",
      acquiredAt: fixedClock(),
    };
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock, journal);

    await expect(
      scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", () =>
        Promise.resolve("unsafe"),
      ),
    ).rejects.toThrow("MODEL_LEASE_CONFLICT");
    await scheduler.reconcileRelease();
    await expect(
      scheduler.withLease(requestId, "qwen3-coder:30b", "specialist-working", () =>
        Promise.resolve("safe"),
      ),
    ).resolves.toBe("safe");
  });
});
