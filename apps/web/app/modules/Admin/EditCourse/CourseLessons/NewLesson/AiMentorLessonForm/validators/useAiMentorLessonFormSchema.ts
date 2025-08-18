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

const MAX_MB_PER_FILE = 10;
const MAX_NUM_OF_FILES = 10;
export const aiMentorLessonFileSchema = z.object({
  files: z
    .array(
      z
        .instanceof(File)
        .refine(
          (f) => f.size < 1024 * 1024 * MAX_MB_PER_FILE,
          `File size must be below ${MAX_MB_PER_FILE} MB`,
        ),
    )
    .max(MAX_NUM_OF_FILES, `You cannot upload more than ${MAX_NUM_OF_FILES} file(s)`)
    .default([]),
});

export type AiMentorLessonContextValues = z.infer<typeof aiMentorLessonFileSchema>;
export type AiMentorLessonFormValues = z.infer<ReturnType<typeof aiMentorLessonFormSchema>>;
