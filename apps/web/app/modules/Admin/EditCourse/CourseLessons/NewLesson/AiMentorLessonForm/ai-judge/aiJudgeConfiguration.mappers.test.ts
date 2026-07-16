import { describe, expect, it } from "vitest";

import {
  mapAiJudgeConfigurationDraftToBaseInput,
  mapAiJudgeConfigurationDraftToTranslationInput,
  mapAiJudgeConfigurationResponseToDraft,
} from "./aiJudgeConfiguration.mappers";

import type { GetConfigurationResponse } from "~/api/generated-api";

const configuration = {
  id: "00000000-0000-4000-8000-000000000001",
  aiMentorLessonId: "00000000-0000-4000-8000-000000000002",
  hasMissingTranslations: false,
  taskGoal: "Handle the conversation",
  passingThresholdPercent: 70,
  totalMaxScore: 1,
  criteria: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      title: "Discovery",
      expectedBehavior: "Ask a relevant question",
      maxScore: 1,
      scoreGuidance: [
        {
          id: "00000000-0000-4000-8000-000000000004",
          score: 1,
          description: "Asks one relevant question",
          example: null,
        },
      ],
    },
  ],
  blockingErrors: [
    {
      id: "00000000-0000-4000-8000-000000000005",
      description: "Invents product facts",
    },
  ],
  language: "en",
  baseLanguage: "en",
  availableLocales: ["en", "pl"],
} satisfies NonNullable<GetConfigurationResponse["data"]>;

describe("AI Judge configuration mappers", () => {
  it("preserves persisted IDs when mapping a response into the editor and back", () => {
    const draft = mapAiJudgeConfigurationResponseToDraft(configuration);

    expect(mapAiJudgeConfigurationDraftToBaseInput(draft)).toMatchObject({
      taskGoal: configuration.taskGoal,
      criteria: [
        {
          id: configuration.criteria[0].id,
          scoreGuidance: [{ id: configuration.criteria[0].scoreGuidance[0].id }],
        },
      ],
      blockingErrors: [{ id: configuration.blockingErrors[0].id }],
    });
  });

  it("flattens translated score guidance and excludes structural scoring fields", () => {
    const draft = mapAiJudgeConfigurationResponseToDraft(configuration);
    const translation = mapAiJudgeConfigurationDraftToTranslationInput(draft);

    expect(translation).toEqual({
      taskGoal: configuration.taskGoal,
      criteria: [
        {
          id: configuration.criteria[0].id,
          title: "Discovery",
          expectedBehavior: "Ask a relevant question",
        },
      ],
      scoreGuidance: [
        {
          id: configuration.criteria[0].scoreGuidance[0].id,
          description: "Asks one relevant question",
          example: undefined,
        },
      ],
      blockingErrors: [
        {
          id: configuration.blockingErrors[0].id,
          description: "Invents product facts",
        },
      ],
    });
    expect(translation).not.toHaveProperty("passingThresholdPercent");
  });

  it("allows task-goal-only configurations with no scored criteria", () => {
    const draft = mapAiJudgeConfigurationResponseToDraft({
      ...configuration,
      totalMaxScore: 0,
      criteria: [],
    });

    expect(mapAiJudgeConfigurationDraftToBaseInput(draft).criteria).toEqual([]);
  });
});
