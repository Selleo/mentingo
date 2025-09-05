import { z } from "zod";

export const courseStatusFormSchema = z.object({
  status: z.enum(["draft", "published", "private"]),
});

export type CourseStatusFormValues = z.infer<typeof courseStatusFormSchema>;
