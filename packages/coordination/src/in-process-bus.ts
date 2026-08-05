import { createHash } from "node:crypto";

import {
  correlationSchema,
  provenanceActorSchema,
  provenanceSchema,
  sensitivitySchema,
  timestampSchema,
  type Correlation,
  type Sensitivity,
} from "@stoic-iris/contracts";
import { z } from "zod";

const coordinationIdSchema = z
  .string()
  .regex(/^(event|subscription|delivery|deadletter)_[0-9a-f-]{36}$/);
const eventIdSchema = coordinationIdSchema.refine((value) => value.startsWith("event_"));
const subscriptionIdSchema = coordinationIdSchema.refine((value) =>
  value.startsWith("subscription_"),
);
const deliveryIdSchema = coordinationIdSchema.refine((value) => value.startsWith("delivery_"));
const deadLetterIdSchema = coordinationIdSchema.refine((value) => value.startsWith("deadletter_"));
const topicSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:\.[a-z0-9-]+)*$/)
  .max(200);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const coordinationEventSchema = z
  .object({
    eventId: eventIdSchema,
    topic: topicSchema,
    schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    occurredAt: timestampSchema,
    publisher: provenanceActorSchema,
    correlation: correlationSchema,
    sensitivity: sensitivitySchema,
    payload: z.record(z.string(), jsonValueSchema),
    sensitivePaths: z.array(z.string().regex(/^\/(?:[^/~]|~[01])+(?:\/(?:[^/~]|~[01])+)*$/)),
    idempotencyKey: z.string().min(1).max(500),
    provenance: provenanceSchema,
  })
  .strict();
export type CoordinationEvent = z.infer<typeof coordinationEventSchema>;

export type DeliveryResult = { status: "ack" } | { status: "retry"; reason: string };

export interface CoordinationSubscription {
  subscriptionId: string;
  topic: string;
  subscriber: z.infer<typeof provenanceActorSchema>;
  maxAttempts: number;
  handler: (delivery: CoordinationDelivery) => DeliveryResult | Promise<DeliveryResult>;
}

export interface CoordinationDelivery {
  deliveryId: string;
  event: CoordinationEvent;
  attempt: number;
  replay: boolean;
}

export interface CoordinationAuthorization {
  canPublish(event: CoordinationEvent): boolean;
  canSubscribe(subscription: Omit<CoordinationSubscription, "handler">): boolean;
  canDeliver(
    event: CoordinationEvent,
    subscription: Omit<CoordinationSubscription, "handler">,
  ): boolean;
}

export type CoordinationAuditType =
  | "EventAccepted"
  | "DuplicateSuppressed"
  | "SubscriptionAuthorized"
  | "SubscriptionDenied"
  | "DeliveryAcknowledged"
  | "DeliveryRetryScheduled"
  | "DeliveryDeadLettered"
  | "ReplayStarted"
  | "ReplayCompleted";

export interface CoordinationAuditEntry {
  sequence: number;
  type: CoordinationAuditType;
  occurredAt: string;
  correlation: Correlation;
  eventId?: string;
  subscriptionId?: string;
  outcome: "succeeded" | "failed" | "denied";
  summary: string;
  previousDigest?: string;
  digest: string;
}

export interface DeadLetter {
  deadLetterId: string;
  event: CoordinationEvent;
  subscriptionId: string;
  attempts: number;
  reason: string;
  recordedAt: string;
}

export interface PublishResult {
  status: "delivered" | "duplicate";
  eventId: string;
  acknowledged: number;
  deadLettered: number;
}

export interface CoordinationBusOptions {
  authorization: CoordinationAuthorization;
  now: () => string;
  id: (kind: "delivery" | "deadletter") => string;
}

const sensitivityRank: Record<Sensitivity, number> = {
  public: 0,
  internal: 1,
  sensitive: 2,
  secret: 3,
  "recovery-authority": 4,
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

function decodePointer(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function redactPayload(
  payload: Record<string, JsonValue>,
  paths: string[],
): Record<string, JsonValue> {
  const clone = structuredClone(payload);
  for (const path of paths) {
    const parts = path.slice(1).split("/").map(decodePointer);
    let cursor: JsonValue = clone;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      if (part === undefined || cursor === null || typeof cursor !== "object") break;
      cursor = Array.isArray(cursor) ? (cursor[Number(part)] ?? null) : (cursor[part] ?? null);
    }
    const final = parts.at(-1);
    if (final === undefined || cursor === null || typeof cursor !== "object") continue;
    if (Array.isArray(cursor)) {
      const target = Number(final);
      if (Number.isInteger(target) && target >= 0 && target < cursor.length)
        cursor[target] = "[REDACTED]";
    } else if (Object.hasOwn(cursor, final)) {
      cursor[final] = "[REDACTED]";
    }
  }
  return clone;
}

function subscriptionView(
  subscription: CoordinationSubscription,
): Omit<CoordinationSubscription, "handler"> {
  return {
    subscriptionId: subscription.subscriptionId,
    topic: subscription.topic,
    subscriber: subscription.subscriber,
    maxAttempts: subscription.maxAttempts,
  };
}

export class InProcessCoordinationBus {
  readonly #authorization: CoordinationAuthorization;
  readonly #now: () => string;
  readonly #id: CoordinationBusOptions["id"];
  readonly #subscriptions = new Map<string, CoordinationSubscription>();
  readonly #events: CoordinationEvent[] = [];
  readonly #idempotency = new Map<string, string>();
  readonly #deadLetters: DeadLetter[] = [];
  readonly #audit: CoordinationAuditEntry[] = [];

  constructor(options: CoordinationBusOptions) {
    this.#authorization = options.authorization;
    this.#now = options.now;
    this.#id = options.id;
  }

  subscribe(subscription: CoordinationSubscription): void {
    subscriptionIdSchema.parse(subscription.subscriptionId);
    topicSchema.parse(subscription.topic);
    provenanceActorSchema.parse(subscription.subscriber);
    z.number().int().min(1).max(10).parse(subscription.maxAttempts);
    if (this.#subscriptions.has(subscription.subscriptionId))
      throw new Error("Subscription already exists.");
    const view = subscriptionView(subscription);
    if (!this.#authorization.canSubscribe(view)) {
      this.#record(
        "SubscriptionDenied",
        { correlationId: subscription.subscriber.actorId },
        "denied",
        "Subscription denied by coordination policy.",
        undefined,
        subscription.subscriptionId,
      );
      throw new Error("Subscription is not authorized.");
    }
    this.#subscriptions.set(subscription.subscriptionId, subscription);
    this.#record(
      "SubscriptionAuthorized",
      { correlationId: subscription.subscriber.actorId },
      "succeeded",
      "Subscription authorized.",
      undefined,
      subscription.subscriptionId,
    );
  }

  async publish(input: CoordinationEvent): Promise<PublishResult> {
    const event = coordinationEventSchema.parse(input);
    if (!this.#authorization.canPublish(event)) throw new Error("Publication is not authorized.");
    const existing = this.#idempotency.get(event.idempotencyKey);
    if (existing !== undefined) {
      this.#record(
        "DuplicateSuppressed",
        event.correlation,
        "succeeded",
        "Duplicate event suppressed by idempotency key.",
        existing,
      );
      return { status: "duplicate", eventId: existing, acknowledged: 0, deadLettered: 0 };
    }
    this.#idempotency.set(event.idempotencyKey, event.eventId);
    this.#events.push(structuredClone(event));
    this.#record(
      "EventAccepted",
      event.correlation,
      "succeeded",
      "Event accepted into the in-process log.",
      event.eventId,
    );
    return this.#deliver(event, false);
  }

  async replay(eventId?: string): Promise<PublishResult[]> {
    const selected =
      eventId === undefined
        ? this.#events
        : this.#events.filter((event) => event.eventId === eventId);
    const correlation = selected[0]?.correlation;
    if (correlation === undefined) return [];
    this.#record(
      "ReplayStarted",
      correlation,
      "succeeded",
      "Deterministic event replay started.",
      eventId,
    );
    const results: PublishResult[] = [];
    for (const event of selected) results.push(await this.#deliver(event, true));
    this.#record(
      "ReplayCompleted",
      correlation,
      "succeeded",
      "Deterministic event replay completed.",
      eventId,
    );
    return results;
  }

  events(): CoordinationEvent[] {
    return structuredClone(this.#events);
  }

  deadLetters(): DeadLetter[] {
    return structuredClone(this.#deadLetters);
  }

  audit(): CoordinationAuditEntry[] {
    return structuredClone(this.#audit);
  }

  verifyAuditChain(): boolean {
    return this.#audit.every((entry, index) => {
      const previous = this.#audit[index - 1];
      const { digest: actualDigest, ...unsigned } = entry;
      return unsigned.previousDigest === previous?.digest && digest(unsigned) === actualDigest;
    });
  }

  async #deliver(event: CoordinationEvent, replay: boolean): Promise<PublishResult> {
    let acknowledged = 0;
    let deadLettered = 0;
    for (const subscription of this.#subscriptions.values()) {
      const view = subscriptionView(subscription);
      if (subscription.topic !== event.topic || !this.#authorization.canDeliver(event, view))
        continue;
      const deliveryEvent = {
        ...event,
        payload: redactPayload(event.payload, event.sensitivePaths),
      };
      let lastReason = "Subscriber did not acknowledge delivery.";
      let completed = false;
      for (let attempt = 1; attempt <= subscription.maxAttempts; attempt += 1) {
        try {
          const result = await subscription.handler({
            deliveryId: deliveryIdSchema.parse(this.#id("delivery")),
            event: structuredClone(deliveryEvent),
            attempt,
            replay,
          });
          if (result.status === "ack") {
            acknowledged += 1;
            completed = true;
            this.#record(
              "DeliveryAcknowledged",
              event.correlation,
              "succeeded",
              "Subscriber acknowledged delivery.",
              event.eventId,
              subscription.subscriptionId,
            );
            break;
          }
          lastReason = result.reason;
        } catch (error) {
          lastReason =
            error instanceof Error ? error.message : "Subscriber failed with a non-error value.";
        }
        if (attempt < subscription.maxAttempts) {
          this.#record(
            "DeliveryRetryScheduled",
            event.correlation,
            "failed",
            `Retry scheduled after attempt ${String(attempt)}.`,
            event.eventId,
            subscription.subscriptionId,
          );
        }
      }
      if (!completed) {
        deadLettered += 1;
        this.#deadLetters.push({
          deadLetterId: deadLetterIdSchema.parse(this.#id("deadletter")),
          event: structuredClone(event),
          subscriptionId: subscription.subscriptionId,
          attempts: subscription.maxAttempts,
          reason: lastReason,
          recordedAt: timestampSchema.parse(this.#now()),
        });
        this.#record(
          "DeliveryDeadLettered",
          event.correlation,
          "failed",
          "Delivery attempts exhausted; event preserved in dead-letter storage.",
          event.eventId,
          subscription.subscriptionId,
        );
      }
    }
    return { status: "delivered", eventId: event.eventId, acknowledged, deadLettered };
  }

  #record(
    type: CoordinationAuditType,
    correlation: Correlation,
    outcome: CoordinationAuditEntry["outcome"],
    summary: string,
    eventId?: string,
    subscriptionId?: string,
  ): void {
    const previousDigest = this.#audit.at(-1)?.digest;
    const unsigned = {
      sequence: this.#audit.length + 1,
      type,
      occurredAt: timestampSchema.parse(this.#now()),
      correlation,
      ...(eventId === undefined ? {} : { eventId }),
      ...(subscriptionId === undefined ? {} : { subscriptionId }),
      outcome,
      summary,
      ...(previousDigest === undefined ? {} : { previousDigest }),
    };
    this.#audit.push({ ...unsigned, digest: digest(unsigned) });
  }
}

export function allowAllLocalCoordination(): CoordinationAuthorization {
  return {
    canPublish: () => true,
    canSubscribe: () => true,
    canDeliver: (event) =>
      sensitivityRank[event.sensitivity] <= sensitivityRank["recovery-authority"],
  };
}
