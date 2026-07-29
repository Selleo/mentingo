import { aiJudgeConfigurations, aiJudgeCriteria, aiJudgeScoreGuidance } from "src/storage/schema";

import { AiJudgeConfigurationTranslationService } from "./ai-judge-configuration-translation.service";

import type { AiJudgeConfigurationRepository } from "./ai-judge-configuration.repository";

describe("AiJudgeConfigurationTranslationService", () => {
  const courseId = "00000000-0000-4000-8000-000000000001";
  const configurationId = "00000000-0000-4000-8000-000000000002";
  const criterionId = "00000000-0000-4000-8000-000000000003";
  const guidanceId = "00000000-0000-4000-8000-000000000004";
  const blockingErrorId = "00000000-0000-4000-8000-000000000005";

  const sharedContext = {
    courseTitle: { en: "Sales course" },
    lessonTitle: { en: "Discovery call" },
    lessonDescription: { en: "Practice a customer conversation" },
  };

  const repository = {
    getConfigurationGraph: jest.fn(),
    getConfigurationsForCourse: jest.fn(),
    getCriteriaForCourse: jest.fn(),
    getScoreGuidanceForCourse: jest.fn(),
    getBlockingErrorsForCourse: jest.fn(),
  };

  const service = new AiJudgeConfigurationTranslationService(
    repository as unknown as AiJudgeConfigurationRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.getConfigurationsForCourse.mockResolvedValue([]);
    repository.getCriteriaForCourse.mockResolvedValue([]);
    repository.getScoreGuidanceForCourse.mockResolvedValue([]);
    repository.getBlockingErrorsForCourse.mockResolvedValue([]);
  });

  it("detects missing text in a translated configuration", async () => {
    repository.getConfigurationGraph.mockResolvedValue({
      configuration: {
        taskGoal: { en: "Handle the conversation", pl: "Poprowadź rozmowę" },
      },
      criteria: [
        {
          title: { en: "Discovery", pl: "Odkrywanie" },
          expectedBehavior: { en: "Ask an open question" },
        },
      ],
      scoreGuidance: [
        {
          description: { en: "Asks a relevant question", pl: "Zadaje trafne pytanie" },
          example: null,
        },
      ],
      blockingErrors: [],
    });

    await expect(service.hasMissingTranslations(configurationId, "pl", "en")).resolves.toBe(true);
  });

  it("does not require a translation for empty optional base text", async () => {
    repository.getConfigurationGraph.mockResolvedValue({
      configuration: {
        taskGoal: { en: "Handle the conversation", pl: "Poprowadź rozmowę" },
      },
      criteria: [],
      scoreGuidance: [
        {
          description: { en: "No evidence", pl: "Brak dowodów" },
          example: null,
        },
      ],
      blockingErrors: [],
    });

    await expect(service.hasMissingTranslations(configurationId, "pl", "en")).resolves.toBe(false);
  });

  it("does not inspect translations for the base language", async () => {
    await expect(service.hasMissingTranslations(configurationId, "en", "en")).resolves.toBe(false);
    expect(repository.getConfigurationGraph).not.toHaveBeenCalled();
  });

  it("collects only missing Judge text and supplies rubric-aware translation context", async () => {
    repository.getConfigurationsForCourse.mockResolvedValue([
      {
        id: configurationId,
        taskGoal: { en: "Identify the customer's needs" },
        ...sharedContext,
      },
    ]);
    repository.getCriteriaForCourse.mockResolvedValue([
      {
        id: criterionId,
        title: { en: "Discovery questions", pl: "Pytania odkrywające" },
        expectedBehavior: { en: "Ask at least two open questions" },
        maxScore: 2,
        taskGoal: { en: "Identify the customer's needs" },
        ...sharedContext,
      },
    ]);
    repository.getScoreGuidanceForCourse.mockResolvedValue([
      {
        id: guidanceId,
        description: { en: "Asks two relevant open questions" },
        example: { en: "What outcome are you trying to achieve?" },
        score: 2,
        criterionTitle: { en: "Discovery questions" },
        criterionExpectedBehavior: { en: "Ask at least two open questions" },
        criterionMaxScore: 2,
        taskGoal: { en: "Identify the customer's needs" },
        ...sharedContext,
      },
    ]);
    repository.getBlockingErrorsForCourse.mockResolvedValue([
      {
        id: blockingErrorId,
        description: { en: "Invents customer facts", pl: "Zmyśla fakty o kliencie" },
        taskGoal: { en: "Identify the customer's needs" },
        ...sharedContext,
      },
    ]);

    const result = await service.getMissingTranslations(courseId, "pl", "en");

    expect(result.map(({ metadata }) => metadata)).toEqual([
      "AI Judge task goal",
      "AI Judge criterion expected behavior",
      "AI Judge score 2 guidance",
      "AI Judge score 2 example",
    ]);
    expect(result[0].data).toMatchObject({
      id: configurationId,
      base: "Identify the customer's needs",
      field: aiJudgeConfigurations.taskGoal,
      idColumn: aiJudgeConfigurations.id,
    });
    expect(result[1].data).toMatchObject({
      id: criterionId,
      field: aiJudgeCriteria.expectedBehavior,
      idColumn: aiJudgeCriteria.id,
    });
    expect(result[2].data).toMatchObject({
      id: guidanceId,
      field: aiJudgeScoreGuidance.description,
      idColumn: aiJudgeScoreGuidance.id,
    });
    expect(result[3].data).toMatchObject({
      id: guidanceId,
      field: aiJudgeScoreGuidance.example,
      idColumn: aiJudgeScoreGuidance.id,
    });
    expect(result[2].context).toMatchObject({
      courseTitle: "Sales course",
      lessonTitle: "Discovery call",
      aiJudgeTaskGoal: "Identify the customer's needs",
      aiJudgeCriterionTitle: "Discovery questions",
      aiJudgeExpectedBehavior: "Ask at least two open questions",
      aiJudgeScore: "2/2",
    });
  });

  it("does not invent a translation when the optional base-language example is empty", async () => {
    repository.getScoreGuidanceForCourse.mockResolvedValue([
      {
        id: guidanceId,
        description: { en: "No relevant evidence", pl: "Brak odpowiednich dowodów" },
        example: null,
        score: 0,
        criterionTitle: { en: "Discovery questions" },
        criterionExpectedBehavior: { en: "Ask at least two open questions" },
        criterionMaxScore: 2,
        taskGoal: { en: "Identify the customer's needs" },
        ...sharedContext,
      },
    ]);

    await expect(service.getMissingTranslations(courseId, "pl", "en")).resolves.toEqual([]);
  });

  it("loads all Judge text groups for the requested course", async () => {
    await service.getMissingTranslations(courseId, "pl", "en");

    expect(repository.getConfigurationsForCourse).toHaveBeenCalledWith(courseId);
    expect(repository.getCriteriaForCourse).toHaveBeenCalledWith(courseId);
    expect(repository.getScoreGuidanceForCourse).toHaveBeenCalledWith(courseId);
    expect(repository.getBlockingErrorsForCourse).toHaveBeenCalledWith(courseId);
  });
});
