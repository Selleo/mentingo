import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

import { MAX_COURSE_DESCRIPTION_HTML_LENGTH } from "../constants";

export const addCourseFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
  description: z
    .string()
    .min(2, "Description must be at least 2 characters.")
    .max(MAX_COURSE_DESCRIPTION_HTML_LENGTH),
  categoryId: z.string().min(1, "Category is required"),
  thumbnailUrl: z.union([z.string().url("Invalid image URL"), z.string().length(0)]).optional(),
  thumbnailS3Key: z.string().optional(),
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
});

export type AddCourseFormValues = z.infer<typeof addCourseFormSchema>;
