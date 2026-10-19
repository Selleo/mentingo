export const courseLearningHeaders = (
  learningStateId?: string | null,
): { headers: Record<string, string> } => ({
  headers: learningStateId ? { "x-course-learning-state-id": learningStateId } : {},
});
