import { MAX_SCORM_PACKAGE_SIZE_BYTES, formatFileSize } from "@repo/shared";
import { z } from "zod";

import type i18next from "i18next";

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const scormLessonFormSchema = (t: typeof i18next.t, isEditing = false) =>
  z.object({
    title: z.string().min(1, { message: t("adminScorm.lesson.validation.titleRequired") }),
    scormFile: isEditing
      ? z.unknown().optional()
      : z
          .unknown()
          .refine((file) => isFile(file), t("adminScorm.lesson.validation.packageRequired"))
          .refine((file) => !isFile(file) || file.size <= MAX_SCORM_PACKAGE_SIZE_BYTES, {
            message: t("adminScorm.lesson.validation.packageTooLarge", {
              maxSize: formatFileSize(MAX_SCORM_PACKAGE_SIZE_BYTES),
            }),
          })
          .refine((file) => !isFile(file) || file.name.toLowerCase().endsWith(".zip"), {
            message: t("adminScorm.lesson.validation.packageInvalidType"),
          }),
  });

export type ScormLessonFormValues = z.infer<ReturnType<typeof scormLessonFormSchema>>;
