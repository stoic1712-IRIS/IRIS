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
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
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

    const grant = registry.issue(request());

    expect(grant.profile).toBe("founder-full-access");
    for (const capability of ordinary) {
      expect(registry.authorize(grant.requestId, capability).grantDigest).toBe(
        grant.grantDigest,
      );
    }
    expect(registry.auditVerified()).toBe(true);
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
    const { sessionBinding: _removed, ...unbound } = request();
    expect(founderAccessRequestSchema.safeParse(unbound).success).toBe(false);
  });
});
