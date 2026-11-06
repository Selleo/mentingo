import { MAX_COURSE_TITLE_LENGTH, SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import type i18next from "i18next";

export const courseSettingsFormSchema = (t: typeof i18next.t) =>
  z.object({
    title: z
      .string()
      .min(2, t("adminCourseView.settings.validation.titleMinLength"))
      .max(
        MAX_COURSE_TITLE_LENGTH,
        t("adminCourseView.settings.validation.titleMaxLength", { max: MAX_COURSE_TITLE_LENGTH }),
      ),
    description: z.string().min(2, t("adminCourseView.settings.validation.descriptionMinLength")),
    categoryId: z.string().min(1, t("adminCourseView.settings.validation.categoryRequired")),
    thumbnailS3Key: z.string().optional(),
    language: z.nativeEnum(SUPPORTED_LANGUAGES),
  });

export type CourseSettingsFormValues = z.infer<ReturnType<typeof courseSettingsFormSchema>>;
