import { z } from "zod";

import type i18next from "i18next";

export const embedLessonResourceSchema = (t: typeof i18next.t) =>
  z.object({
    type: z.string().default("embed"),
    source: z.string().min(1, t("adminCourseView.curriculum.lesson.validation.sourceUrlRequired")),
    isExternal: z.boolean().default(true),
    allowFullscreen: z.boolean().default(false),
  });

export type EmbedLessonResource = z.infer<ReturnType<typeof embedLessonResourceSchema>>;
