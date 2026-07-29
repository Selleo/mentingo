import { AI_JUDGE_CRITERION_STATUS } from "src/ai/judge-configuration/judge-configuration.types";
import { evaluateAiJudgeResult } from "src/ai/utils/judgeEvaluation";

import type { AiJudgeRubric } from "src/ai/judge-configuration/judge-configuration.types";

const rubric: AiJudgeRubric = {
  configurationId: "00000000-0000-4000-8000-000000000001",
  taskGoal: "Discover the client's needs and agree on a next step.",
  passingThresholdPercent: 60,
  criteria: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Needs discovery",
      expectedBehavior: "Asks relevant open questions.",
      maxScore: 5,
      scoreGuidance: [],
    },
  ],
  blockingErrors: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      description: "Invents unsupported facts.",
    },
  ],
};

describe("evaluateAiJudgeResult", () => {
  it("calculates the final result from configured scores instead of model totals", () => {
    expect(
      evaluateAiJudgeResult(
        {
          criterionResults: [
            {
              criterionRef: "C1",
              awardedScore: 3,
              learnerSafeFeedback: "You asked useful questions.",
            },
          ],
          triggeredBlockingErrors: [],
        },
        rubric,
      ),
    ).toEqual({
      score: 3,
      minScore: 3,
      maxScore: 5,
      percentage: 60,
      passed: true,
      criteria: [
        {
          criterionId: rubric.criteria[0].id,
          title: rubric.criteria[0].title,
          awardedScore: 3,
          maxScore: 5,
          status: AI_JUDGE_CRITERION_STATUS.PARTIAL,
          learnerSafeFeedback: "You asked useful questions.",
        },
      ],
      blockingErrors: [],
    });
  });

  it("lets a configured blocking error override a passing score", () => {
    const result = evaluateAiJudgeResult(
      {
        criterionResults: [
          {
            criterionRef: "C1",
            awardedScore: 5,
            learnerSafeFeedback: "The discovery itself was complete.",
          },
        ],
        triggeredBlockingErrors: [
          {
            blockingErrorRef: "B1",
            learnerSafeFeedback: "You presented an unsupported guarantee as a fact.",
          },
        ],
      },
      rubric,
    );

    expect(result).toMatchObject({ score: 5, percentage: 100, passed: false });
  });

  it("rejects incomplete or unknown model references instead of guessing", () => {
    expect(() =>
      evaluateAiJudgeResult(
        {
          criterionResults: [],
          triggeredBlockingErrors: [],
        },
        rubric,
      ),
    ).toThrow("incomplete criterion result set");

    expect(() =>
      evaluateAiJudgeResult(
        {
          criterionResults: [
            {
              criterionRef: "C1",
              awardedScore: 1,
              learnerSafeFeedback: "Some evidence.",
            },
          ],
          triggeredBlockingErrors: [
            {
              blockingErrorRef: "B2",
              learnerSafeFeedback: "Unknown error.",
            },
          ],
        },
        rubric,
      ),
    ).toThrow("unknown or duplicate blocking-error reference");
  });

  it("always passes an empty scored rubric unless a blocking error is triggered", () => {
    const emptyRubric = { ...rubric, criteria: [], passingThresholdPercent: 100 };
    const result = evaluateAiJudgeResult(
      { criterionResults: [], triggeredBlockingErrors: [] },
      emptyRubric,
    );

    expect(result).toMatchObject({
      score: 0,
      minScore: 0,
      maxScore: 0,
      percentage: 100,
      passed: true,
    });
  });
});
