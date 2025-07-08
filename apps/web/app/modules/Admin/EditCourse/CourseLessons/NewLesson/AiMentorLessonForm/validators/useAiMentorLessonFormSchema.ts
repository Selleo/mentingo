import { z } from "zod";

import type { TFunction } from "i18next";

export const aiMentorLessonFormSchema = (t: TFunction) =>
  z.object({
    title: z
      .string()
      .min(1, { message: t("adminCourseView.curriculum.lesson.validation.titleRequired") })
      .max(255, { message: t("adminCourseView.curriculum.lesson.validation.titleMaxLength") }),
    aiMentorInstructions: z
      .string()
      .min(1, {
        message: t("adminCourseView.curriculum.lesson.validation.aiMentorInstructionsRequired"),
      })
      .max(2000, {
        message: t("adminCourseView.curriculum.lesson.validation.aiMentorInstructionsMaxLength"),
      }),
    completionConditions: z
      .string()
      .min(1, {
        message: t("adminCourseView.curriculum.lesson.validation.completionConditionsRequired"),
      })
      .max(1000, {
        message: t("adminCourseView.curriculum.lesson.validation.completionConditionsMaxLength"),
      }),
  });

export type AiMentorLessonFormValues = z.infer<ReturnType<typeof aiMentorLessonFormSchema>>;
