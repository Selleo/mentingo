import { z } from "zod";

export const courseOverviewFormSchema = z.object({
  categoryId: z.string(),
  description: z.string(),
  heroImagePosition: z.number().min(0).max(100),
  imageFile: z.custom<File>().nullable(),
  title: z.string(),
  trailerFile: z.custom<File>().nullable(),
});

export type CourseOverviewFormValues = z.infer<typeof courseOverviewFormSchema>;
