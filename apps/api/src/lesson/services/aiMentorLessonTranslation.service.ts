import { Injectable } from "@nestjs/common";

import { aiMentorLessons } from "src/storage/schema";

import { AdminLessonRepository } from "../repositories/adminLesson.repository";

import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { ContextualCourseTranslationType } from "src/courses/types/course.types";

@Injectable()
export class AiMentorLessonTranslationService {
  constructor(private readonly adminLessonRepository: AdminLessonRepository) {}

  async getMissingTranslations(
    courseId: UUIDType,
    language: SupportedLanguages,
    baseLanguage: SupportedLanguages,
  ): Promise<ContextualCourseTranslationType[]> {
    const aiMentorLessonsForCourse =
      await this.adminLessonRepository.getAiMentorInstructionsForCourse(courseId);

    return aiMentorLessonsForCourse.flatMap((aiMentorLesson) => {
      const base = this.getLanguageValue(aiMentorLesson.aiMentorInstructions, baseLanguage);
      const translated = this.getLanguageValue(aiMentorLesson.aiMentorInstructions, language);

      if (!base?.length || translated?.length) return [];

      return [
        {
          data: {
            id: aiMentorLesson.id,
            base,
            field: aiMentorLessons.aiMentorInstructions,
            idColumn: aiMentorLessons.id,
          },
          metadata: "AI Mentor instructions",
          context: {
            courseTitle: this.getLanguageValue(aiMentorLesson.courseTitle, baseLanguage),
            lessonTitle: this.getLanguageValue(aiMentorLesson.lessonTitle, baseLanguage),
            lessonDescription: this.getLanguageValue(
              aiMentorLesson.lessonDescription,
              baseLanguage,
            ),
          },
        },
      ];
    });
  }

  private getLanguageValue(value: LocalizedText | null, language: SupportedLanguages) {
    return value?.[language];
  }
}
