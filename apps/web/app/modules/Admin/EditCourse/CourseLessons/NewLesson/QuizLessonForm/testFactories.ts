import { ASSESSMENT_FEEDBACK_MODES } from "@repo/shared";

import { defaultQuizFeedbackRanges } from "./defaults/defaultQuizLessonValues";

import type { QuizLessonFormValues } from "./validators/quizLessonFormSchema";

export const makeQuizLessonFormValues = (
  overrides: Partial<QuizLessonFormValues> = {},
): QuizLessonFormValues => ({
  title: "Quiz title",
  feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
  feedbackRanges: defaultQuizFeedbackRanges,
  questions: [],
  ...overrides,
});
