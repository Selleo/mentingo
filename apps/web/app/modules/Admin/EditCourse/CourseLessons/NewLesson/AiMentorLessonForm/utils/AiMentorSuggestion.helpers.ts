import type { AiJudgeConfigurationDraft } from "../AiJudge/aiJudgeConfiguration.types";

const LIST_ITEM_PATTERN = /<li>(.*?)<\/li>/gis;

type SuggestedScoreGuidance = {
  notMetDescription: (expectedBehavior: string) => string;
  notMetExample: (expectedBehavior: string) => string;
  metDescription: (expectedBehavior: string) => string;
  acceptedExamples: string[];
};

const toPlainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

export const createSuggestedAiJudgeConfiguration = (
  criteriaHtml: string,
  passingThresholdPercent: number,
  scoreGuidance: SuggestedScoreGuidance,
  blockingErrorDescriptions: string[] = [],
): AiJudgeConfigurationDraft => {
  const expectedBehaviors = Array.from(criteriaHtml.matchAll(LIST_ITEM_PATTERN), ([, value]) =>
    toPlainText(value),
  ).filter(Boolean);

  return {
    taskGoal: expectedBehaviors.join(" "),
    passingThresholdPercent,
    criteria: expectedBehaviors.map((expectedBehavior, index) => ({
      title: expectedBehavior,
      expectedBehavior,
      maxScore: 1,
      scoreGuidance: [
        {
          score: 0,
          description: scoreGuidance.notMetDescription(expectedBehavior),
          example: scoreGuidance.notMetExample(expectedBehavior),
        },
        {
          score: 1,
          description: scoreGuidance.metDescription(expectedBehavior),
          example: scoreGuidance.acceptedExamples[index],
        },
      ],
    })),
    blockingErrors: blockingErrorDescriptions
      .map((description) => description.trim())
      .filter(Boolean)
      .map((description) => ({ description })),
  };
};
