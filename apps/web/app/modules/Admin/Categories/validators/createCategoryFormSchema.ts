import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

export const createCategoryFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
});

export type CreateCategoryFormValues = z.infer<typeof createCategoryFormSchema>;
