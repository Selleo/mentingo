import { z } from "zod";

export const createPracticeFormSchema = (requiredMessage: string) =>
  z.object({
    challenge: z.string().trim().min(1, requiredMessage).max(1000),
    counterpart: z.string().trim().min(1, requiredMessage).max(1000),
    desiredOutcome: z.string().trim().min(1, requiredMessage).max(1000),
  });

export type PracticeFormValues = z.infer<ReturnType<typeof createPracticeFormSchema>>;
