import { buildAiPracticeJudgeConfiguration } from "src/ai/utils/build-ai-practice-judge-configuration";

import type { GeneratedAiJudgeConfiguration } from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";

describe("buildAiPracticeJudgeConfiguration", () => {
  it("maps a generated Judge configuration into bulk-persistable rows", () => {
    const configuration: GeneratedAiJudgeConfiguration = {
      taskGoal: "Reach a clear agreement.",
      passingThresholdPercent: 70,
      criteria: [
        {
          title: "Clarity",
          expectedBehavior: "States the request clearly.",
          maxScore: 2,
          scoreGuidance: [
            { score: 0, description: "Does not state a request.", example: null },
            { score: 2, description: "States a clear request.", example: "I need..." },
          ],
        },
      ],
      blockingErrors: [{ description: "Makes an unsupported promise." }],
    };

    const graph = buildAiPracticeJudgeConfiguration(
      "00000000-0000-0000-0000-000000000001",
      configuration,
      "en",
    );

    expect(graph.configuration).toEqual(
      expect.objectContaining({
        practiceSessionId: "00000000-0000-0000-0000-000000000001",
        passingThresholdPercent: configuration.passingThresholdPercent,
      }),
    );
    expect(graph.configuration.taskGoal).toMatchObject({ queryChunks: expect.any(Array) });
    expect(graph.criteria).toHaveLength(1);
    expect(graph.criteria[0]).toEqual(
      expect.objectContaining({
        maxScore: configuration.criteria[0].maxScore,
        title: expect.objectContaining({ queryChunks: expect.any(Array) }),
        expectedBehavior: expect.objectContaining({ queryChunks: expect.any(Array) }),
      }),
    );
    expect(graph.scoreGuidance).toEqual([
      expect.objectContaining({
        score: 0,
        criterionId: graph.criteria[0].id,
        description: expect.objectContaining({ queryChunks: expect.any(Array) }),
      }),
      expect.objectContaining({
        score: 2,
        criterionId: graph.criteria[0].id,
        description: expect.objectContaining({ queryChunks: expect.any(Array) }),
        example: expect.objectContaining({ queryChunks: expect.any(Array) }),
      }),
    ]);
    expect(graph.blockingErrors).toEqual([
      expect.objectContaining({
        description: expect.objectContaining({ queryChunks: expect.any(Array) }),
      }),
    ]);
  });
});
