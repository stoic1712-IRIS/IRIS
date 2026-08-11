import { describe, expect, it } from "vitest";

import {
  FounderAccessRegistry,
  founderAccessRequestSchema,
  protectedCapabilitySchema,
  type OrdinaryCapability,
} from "../packages/kernel/src/founder-access-profile.js";

const now = new Date("2026-08-08T12:00:00.000Z");
const ordinary: OrdinaryCapability[] = [
  "goal.manage",
  "research.search",
  "browser.inspect",
  "connector.call-approved",
  "repository.inspect",
  "repository.edit-bounded",
  "terminal.run-approved",
  "dependencies.materialize-approved",
  "verification.run",
  "repair.execute-bounded",
  "repository.commit-candidate",
  "repository.push-branch",
  "repository.create-pull-request",
  "repository.monitor-ci",
  "repository.address-review",
  "repository.merge-reviewed-head",
  "repository.verify-remote",
  "repository.synchronize",
  "repository.rollback-history-preserving",
  "workspace.cleanup",
  "runtime.manage-local",
  "desktop.preview",
  "desktop.operate-bounded",
  "capability.acquire-approved",
  "notification.local",
];

function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "access_founder-session-0001",
    founderId: "Founder" as const,
    authenticated: true as const,
    profile: "founder-full-access" as const,
    capabilities: ordinary,
    sessionBinding: {
      founderSessionId: "session_founder-0001",
      gatewayBootId: "boot_gateway-0001",
    },
    issuedAt: now.toISOString(),
    ...overrides,
  };
}

describe("Founder autonomous Full access", () => {
  it("authorizes the complete ordinary delivery and self-repair surface", () => {
    const registry = new FounderAccessRegistry({
      registeredCapabilities: ordinary,
      founderSessionId: "session_founder-0001",
      gatewayBootId: "boot_gateway-0001",
      now: () => now,
    });

    const grant = registry.issue(request({ expiresAt: "2020-01-01T00:00:00.000Z" }));

    expect(grant.profile).toBe("founder-full-access");
    expect(grant.lifecycle).toBe("session-bound");
    for (const capability of ordinary) {
      expect(registry.authorize(grant.requestId, capability).grantDigest).toBe(grant.grantDigest);
    }
    expect(registry.auditVerified()).toBe(true);
  });

  it("remains valid without a countdown until the Founder session is invalidated", () => {
    let current = now;
    const registry = new FounderAccessRegistry({
      registeredCapabilities: ordinary,
      founderSessionId: "session_founder-0001",
      gatewayBootId: "boot_gateway-0001",
      now: () => current,
    });
    const grant = registry.issue(request());

    current = new Date("2036-08-08T12:00:00.000Z");
    expect(registry.authorize(grant.requestId, "repository.inspect").grantDigest).toBe(
      grant.grantDigest,
    );

    registry.invalidateSession(grant.requestId, "logout");
    expect(() => registry.authorize(grant.requestId, "repository.inspect")).toThrow(
      "FOUNDER_ACCESS_SESSION_INVALIDATED",
    );
  });

  it("invalidates a grant outside its authenticated Founder or gateway boot session", () => {
    const wrongBoot = new FounderAccessRegistry({
      registeredCapabilities: ordinary,
      founderSessionId: "session_founder-0001",
      gatewayBootId: "boot_gateway-0002",
      now: () => now,
    });
    expect(() => wrongBoot.issue(request())).toThrow("FOUNDER_ACCESS_SESSION_MISMATCH");

    const wrongFounder = new FounderAccessRegistry({
      registeredCapabilities: ordinary,
      founderSessionId: "session_founder-0002",
      gatewayBootId: "boot_gateway-0001",
      now: () => now,
    });
    expect(() => wrongFounder.issue(request())).toThrow("FOUNDER_ACCESS_SESSION_MISMATCH");
  });

  it("still excludes every protected effect", () => {
    for (const protectedCapability of protectedCapabilitySchema.options) {
      expect(
        founderAccessRequestSchema.safeParse(
          request({ capabilities: [...ordinary, protectedCapability] }),
        ).success,
      ).toBe(false);
    }
  });

  it("requires a session binding for the autonomous profile", () => {
    const unbound: Partial<ReturnType<typeof request>> = request();
    delete unbound.sessionBinding;
    expect(founderAccessRequestSchema.safeParse(unbound).success).toBe(false);
  });

  it("rejects a partial capability set labeled as Founder Full access", () => {
    const registry = new FounderAccessRegistry({
      registeredCapabilities: ordinary,
      founderSessionId: "session_founder-0001",
      gatewayBootId: "boot_gateway-0001",
      now: () => now,
    });

    expect(() => registry.issue(request({ capabilities: ["goal.manage"] }))).toThrow(
      "FOUNDER_FULL_ACCESS_CAPABILITY_SET_INCOMPLETE",
    );
  });
});
