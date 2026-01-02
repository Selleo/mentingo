import { z } from "zod";

import type i18next from "i18next";

export const embedLessonResourceSchema = (t: typeof i18next.t) =>
  z.object({
    fileUrl: z.string().min(1, t("adminCourseView.curriculum.lesson.validation.sourceUrlRequired")),
    allowFullscreen: z.boolean().default(false),
  });

export type EmbedLessonResource = z.infer<ReturnType<typeof embedLessonResourceSchema>>;
