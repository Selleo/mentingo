import { z } from "zod";

import type { TFunction } from "i18next";

export const liveTrainingLessonFormSchema = (t: TFunction) =>
  z.object({
    title: z
      .string()
      .trim()
      .min(2, t("adminCourseView.curriculum.lesson.validation.titleMinLength"))
      .max(250, t("adminCourseView.curriculum.lesson.validation.titleMaxLength")),
  });

export type LiveTrainingLessonFormValues = z.infer<ReturnType<typeof liveTrainingLessonFormSchema>>;
