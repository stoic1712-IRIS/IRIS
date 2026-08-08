import { describe, expect, it } from "vitest";

import type { IrisModelName } from "../packages/model-gateway/src/model-router.js";
import {
  ModelLeaseScheduler,
  type ModelLease,
  type ModelLifecycleAdapter,
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

describe("ModelLeaseScheduler", () => {
  it("never overlaps Qwen, specialist, reviewer, and synthesis leases", async () => {
    const lifecycle = new RecordingLifecycle();
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock);

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
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock);
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
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock);
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
    await expect(running).rejects.toThrow("aborted");
    expect(lifecycle.released).toEqual(["qwen3.6:27b"]);
    expect(scheduler.activeLease()).toBeNull();
    expect(scheduler.events().map((event) => event.type)).toEqual([
      "acquired",
      "cancelled",
      "release-requested",
      "released",
    ]);
  });

  it("preserves truthful release failure evidence and clears the active lease", async () => {
    const lifecycle = new RecordingLifecycle();
    lifecycle.release = () => Promise.reject(new Error("provider refused release"));
    const scheduler = new ModelLeaseScheduler(lifecycle, fixedClock);

    await expect(
      scheduler.withLease(requestId, "qwen3.6:27b", "orchestrator-planning", () =>
        Promise.resolve("planned"),
      ),
    ).rejects.toThrow("MODEL_LEASE_RELEASE_FAILED");
    expect(scheduler.activeLease()).toBeNull();
    expect(scheduler.events().at(-1)?.type).toBe("release-failed");
  });
});
