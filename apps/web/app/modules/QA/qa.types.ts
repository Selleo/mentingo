import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { z } from "zod";

export const qaFormSchema = z.object({
  title: z.string(),
  description: z.string(),
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
});

export type QAFormValues = z.infer<typeof qaFormSchema>;
