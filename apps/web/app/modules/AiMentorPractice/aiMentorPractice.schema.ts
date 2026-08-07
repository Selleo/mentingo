import { z } from "zod";

export const createPracticeFormSchema = (requiredMessage: string) =>
  z.object({
    scenario: z.string().trim().min(1, requiredMessage).max(3000),
  });

export type PracticeFormValues = z.infer<ReturnType<typeof createPracticeFormSchema>>;
