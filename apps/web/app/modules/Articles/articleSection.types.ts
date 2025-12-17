import { z } from "zod";

export const articleSectionFormSchema = z.object({
  title: z.string().min(1),
});

export type ArticleSectionFormValues = z.infer<typeof articleSectionFormSchema>;
