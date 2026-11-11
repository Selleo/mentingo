import {
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  MAX_SCORM_PACKAGE_SIZE_BYTES,
  MAX_SCORM_THUMBNAIL_FILE_SIZE_BYTES,
  SUPPORTED_LANGUAGES,
  formatFileSize,
} from "@repo/shared";
import { z } from "zod";

import { MAX_COURSE_DESCRIPTION_HTML_LENGTH } from "~/modules/Admin/AddCourse/constants";

import type i18next from "i18next";

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const scormCourseFormSchema = (t: typeof i18next.t) =>
  z.object({
    title: z.string().min(2, t("adminScorm.create.titleMinLength")),
    description: z
      .string()
      .min(2, t("adminScorm.create.descriptionMinLength"))
      .max(
        MAX_COURSE_DESCRIPTION_HTML_LENGTH,
        t("adminScorm.create.descriptionMaxLength", {
          maxLength: MAX_COURSE_DESCRIPTION_HTML_LENGTH,
        }),
      ),
    categoryId: z.string().min(1, t("adminScorm.create.categoryRequired")),
    language: z.nativeEnum(SUPPORTED_LANGUAGES, {
      errorMap: () => ({ message: t("adminScorm.create.languageInvalid") }),
    }),
    thumbnailFile: z
      .unknown()
      .optional()
      .refine((file) => !file || isFile(file), t("adminScorm.create.thumbnailInvalid"))
      .refine(
        (file) => !isFile(file) || file.size <= MAX_SCORM_THUMBNAIL_FILE_SIZE_BYTES,
        t("adminScorm.create.thumbnailTooLarge", {
          maxSize: formatFileSize(MAX_SCORM_THUMBNAIL_FILE_SIZE_BYTES),
        }),
      )
      .refine(
        (file) => !isFile(file) || ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(file.type),
        t("adminScorm.create.thumbnailInvalidType"),
      ),
    scormFile: z
      .unknown()
      .refine((file) => isFile(file), t("adminScorm.create.packageRequired"))
      .refine((file) => !isFile(file) || file.size <= MAX_SCORM_PACKAGE_SIZE_BYTES, {
        message: t("adminScorm.create.packageTooLarge", {
          maxSize: formatFileSize(MAX_SCORM_PACKAGE_SIZE_BYTES),
        }),
      })
      .refine((file) => !isFile(file) || file.name.toLowerCase().endsWith(".zip"), {
        message: t("adminScorm.create.packageInvalidType"),
      }),
  });

export type ScormCourseFormValues = z.infer<ReturnType<typeof scormCourseFormSchema>>;
