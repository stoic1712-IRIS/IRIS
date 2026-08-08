import { describe, expect, it } from "vitest";

import {
  codingEnvelope,
  codingPolicy,
  codingRequest,
  cognitiveHarness,
  conversationRequest,
  directEnvelope,
  delayedSpecialistHarness,
  exactEvidence,
  passedSpecialistArtifact,
  passingReview,
  policy,
  researchEnvelope,
  researchRequest,
  restartHarnessThatFailsBeforeSynthesis,
  restartedHarness,
  requiredEvidenceId,
  synthesis,
} from "./fixtures/qwen-primary-cognitive-orchestration-fixture.js";

describe("Qwen primary cognitive orchestration runtime", () => {
  it("uses Qwen 27B directly for ordinary dialogue without a specialist", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const result = await harness.runtime.start(conversationRequest(), policy(["conversation"]));

    expect(result.phase).toBe("completed");
    expect(result.presentation?.narrative).toBe("Hello, Founder.");
    expect(harness.provider.models).toEqual(["qwen3.6:27b"]);
    expect(harness.worker.calls).toHaveLength(0);
  });

  it("delegates coding, obtains distinct GPT-OSS review, then returns through Qwen", async () => {
    const harness = cognitiveHarness({
      planningEnvelope: codingEnvelope(),
      specialist: passedSpecialistArtifact("qwen3-coder:30b"),
      review: passingReview("gpt-oss:20b"),
      synthesis: synthesis([requiredEvidenceId]),
    });
    const result = await harness.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );

    expect(result.phase).toBe("completed");
    expect(result.presentation?.provenance).toEqual({
      orchestratorModel: "qwen3.6:27b",
      specialistModel: "qwen3-coder:30b",
      reviewerModel: "gpt-oss:20b",
    });
    expect(harness.provider.models).toEqual(["qwen3.6:27b", "qwen3.6:27b"]);
    expect(harness.worker.models).toEqual(["qwen3-coder:30b"]);
    expect(harness.worker.reviewerModels).toEqual(["gpt-oss:20b"]);
    expect(harness.lifecycle.maximumConcurrent).toBe(1);
    expect(harness.transitions.map((event) => event.phase)).toEqual([
      "accepted",
      "orchestrator-planning",
      "delegation-validated",
      "specialist-loading",
      "specialist-working",
      "verification-running",
      "independent-review",
      "orchestrator-synthesizing",
      "completed",
    ]);
  });

  it("rejects duplicate request execution", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const input = conversationRequest();
    await harness.runtime.start(input, policy(["conversation"]));
    await expect(harness.runtime.start(input, policy(["conversation"]))).rejects.toThrow(
      "COGNITIVE_RESUME_BINDING_MISMATCH",
    );
  });

  it("attaches exact evidence unchanged instead of asking Qwen to reproduce it", async () => {
    const exact = exactEvidence({
      kind: "citation",
      exactValue: "https://nodejs.org/en/about/previous-releases",
      requiredInPresentation: true,
    });
    const harness = cognitiveHarness({
      planningEnvelope: researchEnvelope(),
      specialist: passedSpecialistArtifact("gpt-oss:20b", [exact]),
      review: passingReview("qwen3.6:27b", [exact]),
      synthesis: {
        narrative: "The official release table supports the finding.",
        acknowledgedEvidenceIds: [exact.evidenceId],
        authority: "none",
      },
    });

    const result = await harness.runtime.start(
      researchRequest(),
      policy(["research.search", "research.verify-source"]),
    );
    expect(result.presentation?.exactEvidence).toEqual([exact]);
  });

  it("allows one synthesis repair and then preserves evidence in synthesis-failed state", async () => {
    const harness = cognitiveHarness({ synthesisSequence: [synthesis([]), synthesis([])] });
    const result = await harness.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );

    expect(result.phase).toBe("synthesis-failed");
    expect(result.synthesisAttempts).toBe(2);
    expect(result.specialistArtifact?.evidence).not.toHaveLength(0);
    expect(result.presentation).toBeNull();
    expect(harness.provider.synthesisCalls).toBe(2);
  });

  it("keeps cancellation terminal when a non-cooperative specialist returns late", async () => {
    const harness = delayedSpecialistHarness();
    const running = harness.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );
    await harness.worker.started;
    const cancelled = await harness.runtime.cancel(codingRequest().requestId);
    harness.worker.resolve(passedSpecialistArtifact("qwen3-coder:30b"));
    await running;

    expect(cancelled.phase).toBe("cancelled");
    expect((await harness.runtime.state(codingRequest().requestId))?.phase).toBe("cancelled");
    expect(harness.provider.synthesisCalls).toBe(0);
  });

  it("resumes from the last durable artifact without repeating completed model calls", async () => {
    const first = restartHarnessThatFailsBeforeSynthesis();
    const stopped = await first.runtime.start(
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );
    expect(stopped.phase).toBe("recovery-required");

    const second = restartedHarness(first.store);
    const completed = await second.runtime.resume(
      codingRequest().requestId,
      codingRequest(),
      policy(["repository.inspect", "repository.edit-bounded"]),
    );
    expect(completed.phase).toBe("completed");
    expect(second.worker.specialistCalls).toBe(0);
    expect(second.worker.reviewCalls).toBe(0);
    expect(second.provider.synthesisCalls).toBe(1);
  });

  it("persists pause and bounded steering without widening resume bindings", async () => {
    const harness = cognitiveHarness({ planningEnvelope: directEnvelope("Hello, Founder.") });
    const input = conversationRequest();
    await harness.runtime.start(input, policy(["conversation"]));
    const completed = await harness.runtime.pause(input.requestId);
    expect(completed.phase).toBe("completed");

    const delayed = delayedSpecialistHarness();
    const running = delayed.runtime.start(codingRequest(), codingPolicy());
    await delayed.worker.started;
    const steered = await delayed.runtime.steer(
      codingRequest().requestId,
      "Focus on the exact test failure.",
    );
    expect(steered.steeringNotes).toEqual(["Focus on the exact test failure."]);
    const paused = await delayed.runtime.pause(codingRequest().requestId);
    expect(paused.phase).toBe("paused");
    delayed.worker.resolve(passedSpecialistArtifact("qwen3-coder:30b"));
    await running;
    await expect(
      delayed.runtime.resume(
        codingRequest().requestId,
        codingRequest({ pathScope: ["**"] }),
        codingPolicy(),
      ),
    ).rejects.toThrow("COGNITIVE_RESUME_BINDING_MISMATCH");
  });
});
