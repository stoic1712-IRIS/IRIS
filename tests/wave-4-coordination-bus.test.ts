import { describe, expect, it } from "vitest";

import {
  InProcessCoordinationBus,
  allowAllLocalCoordination,
  type CoordinationAuthorization,
  type CoordinationDelivery,
  type CoordinationEvent,
} from "../packages/coordination/src/index.js";

const actor = {
  actorId: "worker_01936f3a-8b5c-7def-8abc-0123456789ab",
  actorType: "iris-core" as const,
  displayName: "IRIS Kernel",
};
const event: CoordinationEvent = {
  eventId: "event_01936f3a-8b5c-7def-8abc-0123456789ab",
  topic: "objective.classified",
  schemaVersion: "1.0.0",
  occurredAt: "2026-08-05T10:00:00-06:00",
  publisher: actor,
  correlation: { correlationId: "request_01936f3a-8b5c-7def-8abc-0123456789ab" },
  sensitivity: "sensitive",
  payload: {
    objective: "Inspect repository",
    credential: "never-deliver",
    nested: { token: "also-private" },
  },
  sensitivePaths: ["/credential", "/nested/token"],
  idempotencyKey: "objective-1-classified-v1",
  provenance: {
    createdAt: "2026-08-05T10:00:00-06:00",
    createdBy: actor,
    sourceKind: "iris-generated",
    sourceReference: "kernel/objective-intake",
    contentDigest: `sha256:${"a".repeat(64)}`,
    parentEvidenceIds: [],
  },
};

function ids() {
  let value = 0;
  return (kind: "delivery" | "deadletter") => {
    value += 1;
    return `${kind}_${value.toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
  };
}

function bus(authorization: CoordinationAuthorization = allowAllLocalCoordination()) {
  return new InProcessCoordinationBus({
    authorization,
    now: () => "2026-08-05T10:01:00-06:00",
    id: ids(),
  });
}

describe("Wave 4 in-process coordination bus", () => {
  it("delivers an authorized event with sensitive fields redacted and immutable storage", async () => {
    const coordination = bus();
    const received: CoordinationDelivery[] = [];
    coordination.subscribe({
      subscriptionId: "subscription_01936f3a-8b5c-7def-8abc-0123456789ab",
      topic: event.topic,
      subscriber: actor,
      maxAttempts: 2,
      handler: (delivery) => {
        received.push(delivery);
        delivery.event.payload.objective = "mutated";
        return { status: "ack" };
      },
    });
    const result = await coordination.publish(event);
    expect(result).toMatchObject({ status: "delivered", acknowledged: 1, deadLettered: 0 });
    expect(received[0]?.event.payload).toEqual({
      objective: "mutated",
      credential: "[REDACTED]",
      nested: { token: "[REDACTED]" },
    });
    expect(coordination.events()[0]?.payload.objective).toBe("Inspect repository");
    expect(coordination.verifyAuditChain()).toBe(true);
  });

  it("denies unauthorized subscriptions before registration", () => {
    const denySubscriptions: CoordinationAuthorization = {
      canPublish: () => true,
      canSubscribe: () => false,
      canDeliver: () => true,
    };
    const coordination = bus(denySubscriptions);
    expect(() => {
      coordination.subscribe({
        subscriptionId: "subscription_02936f3a-8b5c-7def-8abc-0123456789ab",
        topic: event.topic,
        subscriber: actor,
        maxAttempts: 1,
        handler: () => ({ status: "ack" }),
      });
    }).toThrow("not authorized");
    expect(coordination.audit().at(-1)?.type).toBe("SubscriptionDenied");
  });

  it("rejects unauthorized publication without storing or delivering the event", async () => {
    const denyPublication: CoordinationAuthorization = {
      canPublish: () => false,
      canSubscribe: () => true,
      canDeliver: () => true,
    };
    const coordination = bus(denyPublication);
    await expect(coordination.publish(event)).rejects.toThrow("Publication is not authorized");
    expect(coordination.events()).toHaveLength(0);
  });

  it("suppresses duplicate delivery by idempotency key", async () => {
    const coordination = bus();
    let deliveries = 0;
    coordination.subscribe({
      subscriptionId: "subscription_03936f3a-8b5c-7def-8abc-0123456789ab",
      topic: event.topic,
      subscriber: actor,
      maxAttempts: 1,
      handler: () => {
        deliveries += 1;
        return { status: "ack" };
      },
    });
    await coordination.publish(event);
    const duplicate = await coordination.publish({
      ...event,
      eventId: "event_02936f3a-8b5c-7def-8abc-0123456789ab",
    });
    expect(duplicate.status).toBe("duplicate");
    expect(deliveries).toBe(1);
    expect(coordination.events()).toHaveLength(1);
  });

  it("retries bounded failures and preserves an exhausted delivery as a dead letter", async () => {
    const coordination = bus();
    let attempts = 0;
    coordination.subscribe({
      subscriptionId: "subscription_04936f3a-8b5c-7def-8abc-0123456789ab",
      topic: event.topic,
      subscriber: actor,
      maxAttempts: 3,
      handler: () => {
        attempts += 1;
        return { status: "retry", reason: "temporary failure" };
      },
    });
    const result = await coordination.publish(event);
    expect(attempts).toBe(3);
    expect(result.deadLettered).toBe(1);
    expect(coordination.deadLetters()[0]).toMatchObject({
      attempts: 3,
      reason: "temporary failure",
    });
    expect(
      coordination.audit().filter((entry) => entry.type === "DeliveryRetryScheduled"),
    ).toHaveLength(2);
  });

  it("replays the canonical event log deterministically through current authorization", async () => {
    let deliveryAuthorized = true;
    const currentPolicy: CoordinationAuthorization = {
      canPublish: () => true,
      canSubscribe: () => true,
      canDeliver: () => deliveryAuthorized,
    };
    const coordination = bus(currentPolicy);
    const replayFlags: boolean[] = [];
    coordination.subscribe({
      subscriptionId: "subscription_05936f3a-8b5c-7def-8abc-0123456789ab",
      topic: event.topic,
      subscriber: actor,
      maxAttempts: 1,
      handler: (delivery) => {
        replayFlags.push(delivery.replay);
        return { status: "ack" };
      },
    });
    await coordination.publish(event);
    deliveryAuthorized = false;
    const replay = await coordination.replay(event.eventId);
    expect(replayFlags).toEqual([false]);
    expect(replay).toHaveLength(1);
    expect(replay[0]?.acknowledged).toBe(0);
    expect(coordination.audit().map((entry) => entry.type)).toContain("ReplayCompleted");
    expect(coordination.verifyAuditChain()).toBe(true);
  });
});
