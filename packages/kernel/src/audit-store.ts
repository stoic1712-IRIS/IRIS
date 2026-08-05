import { createHash } from "node:crypto";

import { auditEventSchema, type AuditEvent } from "@stoic-iris/contracts";

export function auditEventDigest(event: AuditEvent): `sha256:${string}` {
  const parsed = auditEventSchema.parse(event);
  return `sha256:${createHash("sha256").update(JSON.stringify(parsed)).digest("hex")}`;
}

export function createAuditEvent(event: AuditEvent): AuditEvent {
  return auditEventSchema.parse(event);
}

export class InMemoryAppendOnlyAuditStore {
  readonly #events: AuditEvent[] = [];

  append(candidate: AuditEvent): AuditEvent {
    const event = auditEventSchema.parse(candidate);
    if (this.#events.some((existing) => existing.eventId === event.eventId))
      throw new Error("Duplicate audit event identifier.");

    const previous = this.#events.at(-1);
    const expectedDigest = previous === undefined ? undefined : auditEventDigest(previous);
    if (event.previousEventDigest !== expectedDigest)
      throw new Error("Audit chain predecessor digest does not match.");

    const stored = structuredClone(event);
    this.#events.push(stored);
    return structuredClone(stored);
  }

  list(): readonly AuditEvent[] {
    return structuredClone(this.#events);
  }
}
