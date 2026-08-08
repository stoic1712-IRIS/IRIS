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

interface LeaseReservation {
  readonly requestId: string;
  readonly controller: AbortController;
}

type ReleaseReason = Parameters<ModelLifecycleAdapter["release"]>[1];

export class ModelLeaseScheduler {
  readonly #lifecycle: ModelLifecycleAdapter;
  readonly #now: () => string;
  readonly #events: ModelLeaseEvent[] = [];
  #reservation: LeaseReservation | null = null;
  #active: ModelLease | null = null;

  constructor(lifecycle: ModelLifecycleAdapter, now: () => string) {
    this.#lifecycle = lifecycle;
    this.#now = now;
  }

  async withLease<Result>(
    requestId: string,
    model: IrisModelName,
    phase: CognitiveTurnPhase,
    effect: (lease: ModelLease, signal: AbortSignal) => Promise<Result>,
    outerSignal?: AbortSignal,
  ): Promise<Result> {
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
      this.#record(lease, "acquired", null, acquired.acquiredAt);

      let result: Result | undefined;
      let effectError: unknown;
      let releaseReason: ReleaseReason = "completed";
      try {
        result = await effect(lease, controller.signal);
        if (controller.signal.aborted) releaseReason = "cancelled";
      } catch (error) {
        effectError = error;
        releaseReason = controller.signal.aborted ? "cancelled" : "failed";
      }

      this.#record(lease, "release-requested", releaseReason);
      try {
        const released = await this.#lifecycle.release(lease, releaseReason);
        this.#record(lease, "released", releaseReason, released.releasedAt);
      } catch {
        this.#record(lease, "release-failed", "MODEL_LEASE_RELEASE_FAILED");
        throw new CognitiveTurnError("MODEL_LEASE_RELEASE_FAILED", {
          retryable: true,
          safeDetails: { leaseId: lease.leaseId, model: lease.model },
        });
      } finally {
        this.#active = null;
        this.#reservation = null;
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

  cancel(requestId: string): Promise<void> {
    const reservation = this.#reservation;
    if (reservation?.requestId !== requestId) return Promise.resolve();
    if (!reservation.controller.signal.aborted) {
      reservation.controller.abort(new CognitiveTurnError("COGNITIVE_TURN_CANCELLED"));
      if (this.#active !== null) {
        this.#record(this.#active, "cancelled", "COGNITIVE_TURN_CANCELLED");
      }
    }
    return Promise.resolve();
  }

  activeLease(): ModelLease | null {
    return this.#active === null ? null : Object.freeze({ ...this.#active });
  }

  events(): readonly ModelLeaseEvent[] {
    return Object.freeze(this.#events.map((event) => Object.freeze({ ...event })));
  }

  #record(
    lease: ModelLease,
    type: ModelLeaseEvent["type"],
    reason: string | null,
    occurredAt = this.#now(),
  ): void {
    this.#events.push(
      Object.freeze(
        modelLeaseEventSchema.parse({
          requestId: lease.requestId,
          leaseId: lease.leaseId,
          model: lease.model,
          phase: lease.phase,
          type,
          reason,
          occurredAt,
        }),
      ),
    );
  }
}
