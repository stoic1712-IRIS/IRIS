import { describe, expect, it } from "vitest";

import {
  FounderAccessRegistry,
  founderAccessRequestSchema,
  protectedCapabilitySchema,
  type OrdinaryCapability,
} from "../packages/kernel/src/founder-access-profile.js";

const now = new Date("2026-08-07T14:20:00.000Z");
const capabilities: OrdinaryCapability[] = [
  "goal.manage",
  "research.search",
  "browser.inspect",
  "connector.call-approved",
  "repository.inspect",
  "repository.edit-bounded",
  "terminal.run-approved",
  "repository.commit-candidate",
  "repository.push-branch",
  "repository.create-pull-request",
  "repository.monitor-ci",
  "repository.address-review",
  "repository.verify-remote",
  "workspace.cleanup",
  "desktop.preview",
  "notification.local",
];

function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "access_founder-full-0001",
    founderId: "Founder" as const,
    authenticated: true as const,
    profile: "restricted-full-access" as const,
    capabilities,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
    ...overrides,
  };
}

describe("Cycle Ten restricted Founder Full access profile", () => {
  it("authorizes only registered ordinary capabilities in a bounded session", () => {
    const registry = new FounderAccessRegistry({
      registeredCapabilities: capabilities,
      now: () => now,
    });
    const grant = registry.issue(request());
    expect(grant.profile).toBe("restricted-full-access");
    expect(registry.authorize(grant.requestId, "repository.edit-bounded").grantDigest).toBe(
      grant.grantDigest,
    );
    expect(registry.authorize(grant.requestId, "repository.push-branch").grantDigest).toBe(
      grant.grantDigest,
    );
    expect(registry.auditVerified()).toBe(true);
    expect(JSON.stringify(grant)).not.toMatch(/token|password|secret/iu);
  });

  it("cannot encode protected effects as Full access capabilities", () => {
    for (const protectedCapability of protectedCapabilitySchema.options) {
      expect(
        founderAccessRequestSchema.safeParse(
          request({ capabilities: [...capabilities, protectedCapability] }),
        ).success,
      ).toBe(false);
    }
  });

  it("fails closed for unregistered, duplicate, overlong, expired, and revoked sessions", () => {
    const registry = new FounderAccessRegistry({
      registeredCapabilities: capabilities,
      maximumDurationMs: 60 * 60 * 1_000,
      now: () => now,
    });
    expect(() => registry.issue(request({ capabilities: ["goal.manage", "goal.manage"] }))).toThrow(
      "FOUNDER_ACCESS_CAPABILITY_DUPLICATE",
    );
    expect(() =>
      registry.issue(
        request({
          requestId: "access_founder-full-0002",
          expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1_000).toISOString(),
        }),
      ),
    ).toThrow("FOUNDER_ACCESS_DURATION_EXCEEDED");
    const grant = registry.issue(request({ requestId: "access_founder-full-0003" }));
    registry.revoke(grant.requestId);
    expect(() => registry.authorize(grant.requestId, "goal.manage")).toThrow(
      "FOUNDER_ACCESS_REVOKED",
    );

    const later = new Date(now.getTime() + 2 * 60 * 60 * 1_000);
    const expiring = new FounderAccessRegistry({
      registeredCapabilities: capabilities,
      now: () => later,
    });
    expect(() =>
      expiring.issue(
        request({
          requestId: "access_founder-full-0004",
          issuedAt: new Date(now.getTime() - 2 * 60 * 60 * 1_000).toISOString(),
          expiresAt: new Date(now.getTime() - 60 * 60 * 1_000).toISOString(),
        }),
      ),
    ).toThrow("FOUNDER_ACCESS_TIME_INVALID");
  });
});
