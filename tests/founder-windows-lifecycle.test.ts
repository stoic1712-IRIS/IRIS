import { describe, expect, it } from "vitest";

import {
  classifyFounderRuntimeHealth,
  founderWindowsLifecycleStateSchema,
  type FounderRuntimeHealth,
  type FounderRuntimeProcess,
} from "../packages/runtime/src/index.js";

const checkedAt = "2026-08-08T11:00:00.000Z";
const urls = {
  gateway: "http://127.0.0.1:4174/v1/health",
  voice: "http://127.0.0.1:8765/health",
  search: "http://127.0.0.1:8888/",
  ollama: "http://127.0.0.1:11434/api/tags",
};

function health(ready: string[] = []): FounderRuntimeHealth[] {
  return Object.entries(urls).map(([service, url]) => ({
    service: service as keyof typeof urls,
    url,
    ready: ready.includes(service),
    status: ready.includes(service) ? 200 : null,
    checkedAt,
  }));
}

const process: FounderRuntimeProcess = {
  service: "launcher",
  processId: 4242,
  owner: "iris-founder-runtime",
  commandDigest: `sha256:${"a".repeat(64)}`,
  startedAt: checkedAt,
};

describe("Founder Windows lifecycle state", () => {
  it("classifies stopped, starting, degraded, healthy, and repairing exactly", () => {
    expect(classifyFounderRuntimeHealth({ processes: [], health: health() })).toBe("stopped");
    expect(classifyFounderRuntimeHealth({ processes: [process], health: health() })).toBe(
      "starting",
    );
    expect(
      classifyFounderRuntimeHealth({ processes: [process], health: health(["gateway"]) }),
    ).toBe("degraded");
    expect(
      classifyFounderRuntimeHealth({ processes: [process], health: health(Object.keys(urls)) }),
    ).toBe("healthy");
    expect(
      classifyFounderRuntimeHealth({ processes: [process], health: health(), repairing: true }),
    ).toBe("repairing");
  });

  it("binds process ownership, loopback health, boot identity, and one greeting marker", () => {
    const state = {
      phase: "healthy",
      bootId: "boot_2026-08-08-0001",
      gatewayBootId: "gateway_2026-08-08-0001",
      processes: [process],
      health: health(Object.keys(urls)),
      lastGreetingBootId: "boot_2026-08-08-0001",
      updatedAt: checkedAt,
    };
    expect(founderWindowsLifecycleStateSchema.parse(state)).toEqual(state);
    expect(
      founderWindowsLifecycleStateSchema.safeParse({
        ...state,
        health: [{ ...state.health[0], url: "http://0.0.0.0:4174/" }, ...state.health.slice(1)],
      }).success,
    ).toBe(false);
    expect(
      founderWindowsLifecycleStateSchema.safeParse({
        ...state,
        lastGreetingBootId: "boot_other-0001",
      }).success,
    ).toBe(false);
  });
});
