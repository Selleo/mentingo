import { aiMentorLessons } from "src/storage/schema";

import { AiMentorLessonTranslationService } from "./aiMentorLessonTranslation.service";

import type { AdminLessonRepository } from "../repositories/adminLesson.repository";

describe("AiMentorLessonTranslationService", () => {
  const courseId = "00000000-0000-4000-8000-000000000001";
  const aiMentorLessonId = "00000000-0000-4000-8000-000000000002";
  const repository = {
    getAiMentorInstructionsForCourse: jest.fn(),
  };
  const service = new AiMentorLessonTranslationService(
    repository as unknown as AdminLessonRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    repository.getAiMentorInstructionsForCourse.mockResolvedValue([]);
  });

  it("collects missing AI Mentor instructions with lesson context", async () => {
    repository.getAiMentorInstructionsForCourse.mockResolvedValue([
      {
        id: aiMentorLessonId,
        aiMentorInstructions: { en: "Act as a customer and ask clarifying questions." },
        courseTitle: { en: "Sales course" },
        lessonTitle: { en: "Discovery call" },
        lessonDescription: { en: "Practice a customer conversation" },
      },
    ]);

    const result = await service.getMissingTranslations(courseId, "pl", "en");

    expect(result).toEqual([
      {
        data: {
          id: aiMentorLessonId,
          base: "Act as a customer and ask clarifying questions.",
          field: aiMentorLessons.aiMentorInstructions,
          idColumn: aiMentorLessons.id,
        },
        metadata: "AI Mentor instructions",
        context: {
          courseTitle: "Sales course",
          lessonTitle: "Discovery call",
          lessonDescription: "Practice a customer conversation",
        },
      },
    ]);
  });

  it("does not collect instructions that already have the requested translation", async () => {
    repository.getAiMentorInstructionsForCourse.mockResolvedValue([
      {
        id: aiMentorLessonId,
        aiMentorInstructions: {
          en: "Act as a customer.",
          pl: "Odegraj rolę klienta.",
        },
        courseTitle: { en: "Sales course" },
        lessonTitle: { en: "Discovery call" },
        lessonDescription: {},
      },
    ]);

    await expect(service.getMissingTranslations(courseId, "pl", "en")).resolves.toEqual([]);
  });
});
