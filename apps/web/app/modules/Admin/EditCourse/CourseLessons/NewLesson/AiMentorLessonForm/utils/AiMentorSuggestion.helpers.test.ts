import { describe, expect, it } from "vitest";

import { createSuggestedAiJudgeConfiguration } from "./AiMentorSuggestion.helpers";

describe("createSuggestedAiJudgeConfiguration", () => {
  it("maps legacy suggestion behaviors into a structured Judge configuration", () => {
    const result = createSuggestedAiJudgeConfiguration(
      "<ul><li>Asks about the budget.</li><li>Offers a suitable proposal.</li></ul><strong>Threshold:</strong> 1 of 2.",
      50,
      {
        notMetDescription: (behavior) => `No observable evidence of: ${behavior}`,
        notMetExample: (behavior) => `The response omits or contradicts: ${behavior}`,
        metDescription: (behavior) =>
          `Clearly demonstrates in a context-appropriate way: ${behavior}`,
        acceptedExamples: [
          "What budget range have you allocated?",
          "I suggest a phased proposal that fits your constraints.",
        ],
      },
      ["Makes a commitment that contradicts the client's constraints."],
    );

    expect(result).toEqual({
      taskGoal: "Asks about the budget. Offers a suitable proposal.",
      passingThresholdPercent: 50,
      criteria: [
        {
          title: "Asks about the budget.",
          expectedBehavior: "Asks about the budget.",
          maxScore: 1,
          scoreGuidance: [
            {
              score: 0,
              description: "No observable evidence of: Asks about the budget.",
              example: "The response omits or contradicts: Asks about the budget.",
            },
            {
              score: 1,
              description:
                "Clearly demonstrates in a context-appropriate way: Asks about the budget.",
              example: "What budget range have you allocated?",
            },
          ],
        },
        {
          title: "Offers a suitable proposal.",
          expectedBehavior: "Offers a suitable proposal.",
          maxScore: 1,
          scoreGuidance: [
            {
              score: 0,
              description: "No observable evidence of: Offers a suitable proposal.",
              example: "The response omits or contradicts: Offers a suitable proposal.",
            },
            {
              score: 1,
              description:
                "Clearly demonstrates in a context-appropriate way: Offers a suitable proposal.",
              example: "I suggest a phased proposal that fits your constraints.",
            },
          ],
        },
      ],
      blockingErrors: [
        { description: "Makes a commitment that contradicts the client's constraints." },
      ],
    });
  });
});
