import { describe, expect, it } from "vitest";

import {
  codingEnvelope,
  codingRequest,
  cognitiveHarness,
  conversationRequest,
  directEnvelope,
  exactEvidence,
  passedSpecialistArtifact,
  passingReview,
  policy,
  researchEnvelope,
  researchRequest,
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
});
