import { z } from "zod";

export const createCategoryFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
});

export type CreateCategoryFormValues = z.infer<typeof createCategoryFormSchema>;
