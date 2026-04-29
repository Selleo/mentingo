import { z } from "zod";

export const newChapterFormSchema = z.object({
  title: z.string(),
  pointsOverride: z.number().int().min(0).nullable().optional(),
});

export type NewChapterFormValues = z.infer<typeof newChapterFormSchema>;
