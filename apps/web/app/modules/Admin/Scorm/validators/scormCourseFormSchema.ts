import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import { MAX_COURSE_DESCRIPTION_HTML_LENGTH } from "~/modules/Admin/AddCourse/constants";

const MAX_SCORM_FILE_SIZE = 500 * 1024 * 1024;
const MAX_THUMBNAIL_FILE_SIZE = 20 * 1024 * 1024;

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

export const scormCourseFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
  description: z
    .string()
    .min(2, "Description must be at least 2 characters.")
    .max(MAX_COURSE_DESCRIPTION_HTML_LENGTH),
  categoryId: z.string().min(1, "Category is required"),
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  thumbnailFile: z
    .unknown()
    .optional()
    .refine((file) => !file || isFile(file), "Thumbnail must be a valid image file")
    .refine(
      (file) => !isFile(file) || file.size <= MAX_THUMBNAIL_FILE_SIZE,
      "Thumbnail must be less than 20MB",
    ),
  scormFile: z
    .unknown()
    .refine((file) => isFile(file), "SCORM package is required")
    .refine((file) => !isFile(file) || file.size <= MAX_SCORM_FILE_SIZE, {
      message: "SCORM package must be less than 500MB",
    })
    .refine((file) => !isFile(file) || file.name.toLowerCase().endsWith(".zip"), {
      message: "SCORM package must be a .zip file",
    }),
});

export type ScormCourseFormValues = z.infer<typeof scormCourseFormSchema>;
