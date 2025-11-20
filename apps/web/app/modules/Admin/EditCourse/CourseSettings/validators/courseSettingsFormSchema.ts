import { z } from "zod";

import type i18next from "i18next";

export const courseSettingsFormSchema = (t: typeof i18next.t) =>
  z.object({
    title: z
      .string()
      .min(2, t("adminCourseView.settings.validation.titleMinLength"))
      .max(250, t("adminCourseView.settings.validation.titleMaxLength")),
    description: z.string().min(2, t("adminCourseView.settings.validation.descriptionMinLength")),
    categoryId: z.string().min(1, t("adminCourseView.settings.validation.categoryRequired")),
    thumbnailS3Key: z.string().optional(),
    language: z.string(),
  });

export type CourseSettingsFormValues = z.infer<ReturnType<typeof courseSettingsFormSchema>>;
