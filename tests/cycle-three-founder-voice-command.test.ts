import { describe, expect, it } from "vitest";

import { validateFounderVoiceCommand } from "../packages/kernel/src/index.js";

describe("Cycle Three Founder voice command contract", () => {
  it("accepts an ephemeral non-mutating command", () => {
    const command = validateFounderVoiceCommand({
      source: "voice",
      transcript: "IRIS, show me the capability tree.",
      intent: "show-capabilities",
      audioRetention: "none",
      transcriptRetention: "ephemeral",
      mayExecuteMutation: false,
      requiresFounderConfirmation: false,
    });

    expect(command.intent).toBe("show-capabilities");
    expect(command.audioRetention).toBe("none");
    expect(command.mayExecuteMutation).toBe(false);
  });

  it("rejects a voice command that claims mutation authority", () => {
    expect(() =>
      validateFounderVoiceCommand({
        source: "voice",
        transcript: "Change the repository.",
        intent: "propose-mission",
        audioRetention: "none",
        transcriptRetention: "ephemeral",
        mayExecuteMutation: true,
        requiresFounderConfirmation: true,
      }),
    ).toThrow();
  });
});
