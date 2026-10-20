import { COURSE_LEARNING_STATE_HEADER } from "@repo/shared";

export const courseLearningHeaders = (
  learningStateId?: string | null,
): { headers: Record<string, string> } => ({
  headers: learningStateId ? { [COURSE_LEARNING_STATE_HEADER]: learningStateId } : {},
});
