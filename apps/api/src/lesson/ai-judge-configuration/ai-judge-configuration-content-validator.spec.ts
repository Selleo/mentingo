import { validateAiJudgeConfigurationContent } from "./ai-judge-configuration-content-validator";
import { AI_JUDGE_CONTENT_VALIDATION_CODE } from "./ai-judge-configuration-content-validator.types";

import type { AiJudgeConfigurationContent } from "./ai-judge-configuration.schema";

const createConfiguration = (
  scoreGuidance: AiJudgeConfigurationContent["criteria"][number]["scoreGuidance"],
  maxScore = 2,
): AiJudgeConfigurationContent => ({
  taskGoal: "Resolve the customer's concern",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Clarifies the concern",
      expectedBehavior: "Asks questions before proposing a solution",
      maxScore,
      scoreGuidance,
    },
  ],
  blockingErrors: [],
});

describe("validateAiJudgeConfigurationContent", () => {
  it("accepts complete exact-score guidance and configurations without criteria", () => {
    expect(
      validateAiJudgeConfigurationContent(
        createConfiguration([
          { score: 0, description: "Does not ask a question" },
          { score: 1, description: "Asks one broad question" },
          { score: 2, description: "Clarifies the cause and impact" },
        ]),
      ),
    ).toEqual([]);
    expect(
      validateAiJudgeConfigurationContent({
        ...createConfiguration([]),
        criteria: [],
      }),
    ).toEqual([]);
  });

  it("reports guidance scores outside the criterion range", () => {
    const issues = validateAiJudgeConfigurationContent(
      createConfiguration([
        { score: -1, description: "Negative score" },
        { score: 0, description: "No evidence" },
        { score: 1, description: "Partial evidence" },
        { score: 2, description: "Full evidence" },
        { score: 3, description: "Above maximum" },
      ]),
    );

    expect(issues).toEqual([
      {
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.GUIDANCE_SCORE_OUT_OF_RANGE,
        criterionIndex: 0,
        score: -1,
        maxScore: 2,
      },
      {
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.GUIDANCE_SCORE_OUT_OF_RANGE,
        criterionIndex: 0,
        score: 3,
        maxScore: 2,
      },
    ]);
  });

  it("reports duplicate guidance scores once per duplicated value", () => {
    const issues = validateAiJudgeConfigurationContent(
      createConfiguration([
        { score: 0, description: "No evidence" },
        { score: 1, description: "Some evidence" },
        { score: 1, description: "Different partial evidence" },
        { score: 1, description: "Third partial description" },
        { score: 2, description: "Full evidence" },
      ]),
    );

    expect(issues).toEqual([
      {
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.DUPLICATE_GUIDANCE_SCORE,
        criterionIndex: 0,
        score: 1,
      },
    ]);
  });

  it("reports every missing exact score", () => {
    const issues = validateAiJudgeConfigurationContent(
      createConfiguration(
        [
          { score: 0, description: "No evidence" },
          { score: 3, description: "Full evidence" },
        ],
        3,
      ),
    );

    expect(issues).toEqual([
      {
        code: AI_JUDGE_CONTENT_VALIDATION_CODE.MISSING_GUIDANCE_SCORES,
        criterionIndex: 0,
        missingScores: [1, 2],
      },
    ]);
  });
});
