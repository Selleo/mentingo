import { z } from "zod";

import { MAX_EMBED_LESSON_RESOURCES } from "../constants";

import { embedLessonResourceSchema } from "./embedLessonResource.schema";

import type i18next from "i18next";

export const embedLessonFormSchema = (t: typeof i18next.t) =>
  z.object({
    title: z.string().min(1, t("adminCourseView.curriculum.lesson.validation.titleRequired")),
    type: z.literal("embed"),
    resources: z
      .array(embedLessonResourceSchema(t))
      .max(
        MAX_EMBED_LESSON_RESOURCES,
        t("adminCourseView.curriculum.lesson.validation.maxResources", {
          count: MAX_EMBED_LESSON_RESOURCES,
        }),
      )
      .optional(),
  });

export type EmbedLessonFormValues = z.infer<ReturnType<typeof embedLessonFormSchema>>;
