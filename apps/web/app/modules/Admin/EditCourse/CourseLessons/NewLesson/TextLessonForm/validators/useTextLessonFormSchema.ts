import { z } from "zod";

import type i18next from "i18next";

export const textLessonFormSchema = (t: typeof i18next.t) =>
  z.object({
    title: z
      .string()
      .min(1, { message: t("adminCourseView.curriculum.lesson.validation.titleRequired") }),
    description: z
      .string()
      .min(1, { message: t("adminCourseView.curriculum.lesson.validation.descriptionRequired") })
      .max(5000, {
        message: t("adminCourseView.curriculum.lesson.validation.descriptionMaxLength"),
      })
      .trim()
      .refine((val) => val !== "<p></p>" && val.trim() !== "", {
        message: t("adminCourseView.curriculum.lesson.validation.descriptionRequired"),
      }),
    type: z.string(),
  });

export type TextLessonFormValues = z.infer<ReturnType<typeof textLessonFormSchema>>;
