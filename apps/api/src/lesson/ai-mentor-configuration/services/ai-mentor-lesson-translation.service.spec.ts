import { AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { aiMentorConfigurations } from "src/storage/schema";

import { AiMentorLessonTranslationService } from "./ai-mentor-lesson-translation.service";

import type { AiMentorConfigurationRepository } from "../repositories/ai-mentor-configuration.repository";

describe("AiMentorLessonTranslationService", () => {
  const courseId = "00000000-0000-4000-8000-000000000001";
  const configurationId = "00000000-0000-4000-8000-000000000002";
  const repository = {
    getConfigurationsForCourse: jest.fn(),
  };
  const service = new AiMentorLessonTranslationService(
    repository as unknown as AiMentorConfigurationRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.getConfigurationsForCourse.mockResolvedValue([]);
  });

  it("collects missing structured AI Mentor fields with lesson context", async () => {
    repository.getConfigurationsForCourse.mockResolvedValue([
      {
        configurationId,
        type: AI_MENTOR_TYPE.ROLEPLAY,
        openingInstruction: null,
        additionalInstructions: { en: "Act as a customer and ask clarifying questions." },
        teacherConfigurationId: null,
        taskGoal: null,
        expertise: null,
        contentScope: null,
        feedbackGuidance: null,
        roleplayConfigurationId: null,
        scenario: null,
        aiRole: null,
        learnerRole: null,
        characterGoal: null,
        factsAndConstraints: null,
        courseTitle: { en: "Sales course" },
        lessonTitle: { en: "Discovery call" },
        lessonDescription: { en: "Practice a customer conversation" },
      },
    ]);

    const result = await service.getMissingTranslations(
      courseId,
      SUPPORTED_LANGUAGES.PL,
      SUPPORTED_LANGUAGES.EN,
    );

    expect(result).toEqual([
      {
        data: {
          id: configurationId,
          base: "Act as a customer and ask clarifying questions.",
          field: aiMentorConfigurations.additionalInstructions,
          idColumn: aiMentorConfigurations.id,
        },
        metadata: "AI Mentor additional instructions",
        context: {
          courseTitle: "Sales course",
          lessonTitle: "Discovery call",
          lessonDescription: "Practice a customer conversation",
        },
      },
    ]);
  });

  it("does not collect a field that already has the requested translation", async () => {
    repository.getConfigurationsForCourse.mockResolvedValue([
      {
        configurationId,
        type: AI_MENTOR_TYPE.ROLEPLAY,
        openingInstruction: null,
        additionalInstructions: {
          en: "Act as a customer.",
          pl: "Odegraj rolę klienta.",
        },
        teacherConfigurationId: null,
        taskGoal: null,
        expertise: null,
        contentScope: null,
        feedbackGuidance: null,
        roleplayConfigurationId: null,
        scenario: null,
        aiRole: null,
        learnerRole: null,
        characterGoal: null,
        factsAndConstraints: null,
        courseTitle: { en: "Sales course" },
        lessonTitle: { en: "Discovery call" },
        lessonDescription: {},
      },
    ]);

    await expect(
      service.getMissingTranslations(courseId, SUPPORTED_LANGUAGES.PL, SUPPORTED_LANGUAGES.EN),
    ).resolves.toEqual([]);
  });
});
