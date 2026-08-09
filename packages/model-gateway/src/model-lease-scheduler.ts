import {
  modelLeaseEventSchema,
  type CognitiveTurnPhase,
  type ModelLeaseEvent,
} from "./cognitive-turn-contracts.js";
import { CognitiveTurnError } from "./cognitive-turn-errors.js";
import type { IrisModelName } from "./model-router.js";

export interface ModelLifecycleAdapter {
  acquire(
    requestId: string,
    model: IrisModelName,
    signal: AbortSignal,
  ): Promise<{ leaseId: string; acquiredAt: string }>;
  release(
    lease: ModelLease,
    reason: "completed" | "failed" | "cancelled",
  ): Promise<{ releasedAt: string }>;
}

export interface ModelLease {
  readonly requestId: string;
  readonly leaseId: string;
  readonly model: IrisModelName;
  readonly phase: CognitiveTurnPhase;
  readonly acquiredAt: string;
}

export interface ModelLeaseJournal {
  loadActive(): Promise<ModelLease | null>;
  append(event: ModelLeaseEvent): Promise<void>;
}

interface LeaseReservation {
  readonly requestId: string;
  readonly controller: AbortController;
}

type ReleaseReason = Parameters<ModelLifecycleAdapter["release"]>[1];

export class ModelLeaseScheduler {
  readonly #lifecycle: ModelLifecycleAdapter;
  readonly #now: () => string;
  readonly #journal: ModelLeaseJournal;
  readonly #events: ModelLeaseEvent[] = [];
  #reservation: LeaseReservation | null = null;
  #active: ModelLease | null = null;
  #hydrated = false;

  constructor(lifecycle: ModelLifecycleAdapter, now: () => string, journal: ModelLeaseJournal) {
    this.#lifecycle = lifecycle;
    this.#now = now;
    this.#journal = journal;
  }

  async withLease<Result>(
    requestId: string,
    model: IrisModelName,
    phase: CognitiveTurnPhase,
    effect: (lease: ModelLease, signal: AbortSignal) => Promise<Result>,
    outerSignal?: AbortSignal,
  ): Promise<Result> {
    await this.#hydrate();
    if (this.#reservation !== null) {
      throw new CognitiveTurnError("MODEL_LEASE_CONFLICT", {
        safeDetails: { activeRequestId: this.#reservation.requestId },
      });
    }

    const controller = new AbortController();
    const reservation = Object.freeze({ requestId, controller });
    this.#reservation = reservation;
    const abortFromOuter = () => {
      controller.abort(outerSignal?.reason);
    };
    if (outerSignal?.aborted) abortFromOuter();
    else outerSignal?.addEventListener("abort", abortFromOuter, { once: true });

    try {
      const acquired = await this.#lifecycle.acquire(requestId, model, controller.signal);
      const lease = Object.freeze({
        requestId,
        leaseId: acquired.leaseId,
        model,
        phase,
        acquiredAt: acquired.acquiredAt,
      });
      this.#active = lease;
      await this.#record(lease, "acquired", null, acquired.acquiredAt);
      if (
        controller.signal.aborted &&
        !this.#events.some((event) => event.leaseId === lease.leaseId && event.type === "cancelled")
      ) {
        await this.#record(lease, "cancelled", "COGNITIVE_TURN_CANCELLED");
      }

      let result: Result | undefined;
      let effectError: unknown;
      let releaseReason: ReleaseReason = "completed";
      const wasAborted = () => controller.signal.aborted;
      if (wasAborted()) {
        effectError = controller.signal.reason;
        releaseReason = "cancelled";
      } else {
        try {
          result = await effect(lease, controller.signal);
          if (wasAborted()) releaseReason = "cancelled";
        } catch (error) {
          effectError = error;
          releaseReason = wasAborted() ? "cancelled" : "failed";
        }
      }

      await this.#record(lease, "release-requested", releaseReason);
      try {
        const released = await this.#lifecycle.release(lease, releaseReason);
        await this.#record(lease, "released", releaseReason, released.releasedAt);
        this.#active = null;
        this.#reservation = null;
      } catch {
        await this.#record(lease, "release-failed", "MODEL_LEASE_RELEASE_FAILED");
        throw new CognitiveTurnError("MODEL_LEASE_RELEASE_FAILED", {
          retryable: true,
          safeDetails: { leaseId: lease.leaseId, model: lease.model },
        });
      }

      if (effectError !== undefined) {
        if (effectError instanceof Error) throw effectError;
        throw new CognitiveTurnError("COGNITIVE_SPECIALIST_UNAVAILABLE");
      }
      return result as Result;
    } catch (error) {
      if (this.#active === null) this.#reservation = null;
      throw error;
    } finally {
      outerSignal?.removeEventListener("abort", abortFromOuter);
    }
  }

  async cancel(requestId: string): Promise<void> {
    await this.#hydrate();
    const reservation = this.#reservation;
    if (reservation?.requestId !== requestId) return Promise.resolve();
    if (!reservation.controller.signal.aborted) {
      reservation.controller.abort(new CognitiveTurnError("COGNITIVE_TURN_CANCELLED"));
      if (this.#active !== null) {
        await this.#record(this.#active, "cancelled", "COGNITIVE_TURN_CANCELLED");
      }
    }
  }

  async reconcileRelease(reason: ReleaseReason = "failed"): Promise<void> {
    await this.#hydrate();
    const lease = this.#active;
    if (lease === null) return;
    await this.#record(lease, "release-requested", reason);
    try {
      const released = await this.#lifecycle.release(lease, reason);
      await this.#record(lease, "released", reason, released.releasedAt);
      this.#active = null;
      this.#reservation = null;
    } catch {
      await this.#record(lease, "release-failed", "MODEL_LEASE_RELEASE_FAILED");
      throw new CognitiveTurnError("MODEL_LEASE_RELEASE_FAILED", {
        retryable: true,
        safeDetails: { leaseId: lease.leaseId, model: lease.model },
      });
    }
  }

  activeLease(): ModelLease | null {
    return this.#active === null ? null : Object.freeze({ ...this.#active });
  }

  events(): readonly ModelLeaseEvent[] {
    return Object.freeze(this.#events.map((event) => Object.freeze({ ...event })));
  }

  async #hydrate(): Promise<void> {
    if (this.#hydrated) return;
    const restored = await this.#journal.loadActive();
    if (restored !== null) {
      const controller = new AbortController();
      this.#active = Object.freeze({ ...restored });
      this.#reservation = Object.freeze({ requestId: restored.requestId, controller });
    }
    this.#hydrated = true;
  }

  async #record(
    lease: ModelLease,
    type: ModelLeaseEvent["type"],
    reason: string | null,
    occurredAt = this.#now(),
  ): Promise<void> {
    const event = Object.freeze(
      modelLeaseEventSchema.parse({
        requestId: lease.requestId,
        leaseId: lease.leaseId,
        model: lease.model,
        phase: lease.phase,
        type,
        reason,
        occurredAt,
      }),
    );
    await this.#journal.append(event);
    this.#events.push(event);
  }
}
