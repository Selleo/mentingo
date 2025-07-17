import { z } from "zod";

import type { TFunction } from "i18next";

const stripHtmlTags = (str: string): string => {
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-zA-Z0-9#]+;/g, "")
    .trim();
};

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
      .refine(
        (val) => {
          const textContent = stripHtmlTags(val);
          return textContent.length > 0;
        },
        {
          message: t("adminCourseView.curriculum.lesson.validation.aiMentorInstructionsRequired"),
        },
      )
      .refine(
        (val) => {
          const textContent = stripHtmlTags(val);
          return textContent.length <= 2000;
        },
        {
          message: t("adminCourseView.curriculum.lesson.validation.aiMentorInstructionsMaxLength"),
        },
      ),
    completionConditions: z
      .string()
      .min(1, {
        message: t("adminCourseView.curriculum.lesson.validation.completionConditionsRequired"),
      })
      .refine(
        (val) => {
          const textContent = stripHtmlTags(val);
          return textContent.length > 0;
        },
        {
          message: t("adminCourseView.curriculum.lesson.validation.completionConditionsRequired"),
        },
      )
      .refine(
        (val) => {
          const textContent = stripHtmlTags(val);
          return textContent.length <= 1000;
        },
        {
          message: t("adminCourseView.curriculum.lesson.validation.completionConditionsMaxLength"),
        },
      ),
  });

export type AiMentorLessonFormValues = z.infer<ReturnType<typeof aiMentorLessonFormSchema>>;
