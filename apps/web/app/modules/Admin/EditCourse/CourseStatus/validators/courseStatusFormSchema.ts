import { COURSE_STATUSES } from "@repo/shared";
import { z } from "zod";

export const courseStatusFormSchema = z.object({
  status: z.enum([COURSE_STATUSES.DRAFT, COURSE_STATUSES.PUBLISHED, COURSE_STATUSES.PRIVATE]),
});

export type CourseStatusFormValues = z.infer<typeof courseStatusFormSchema>;
