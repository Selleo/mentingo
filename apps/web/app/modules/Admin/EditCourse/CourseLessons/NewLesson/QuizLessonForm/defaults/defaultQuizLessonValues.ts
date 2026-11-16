import { ASSESSMENT_FEEDBACK_MODES } from "@repo/shared";

import type { QuizFeedbackRange } from "../QuizLessonForm.types";
import type { AssessmentFeedbackMode } from "@repo/shared";

type QuizLessonProps = {
  thresholdScore: number;
  attemptsLimit: number;
  quizCooldownInHours: number;
  feedbackMode: AssessmentFeedbackMode;
};

export const defaultQuizLessonValues: QuizLessonProps = {
  thresholdScore: 0,
  attemptsLimit: 1,
  quizCooldownInHours: 24,
  feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
};

// Contiguous, inclusive buckets covering 0..100 that the author can edit, extend, or remove.
export const defaultQuizFeedbackRanges: QuizFeedbackRange[] = [
  { minPercent: 0, maxPercent: 49, message: "" },
  { minPercent: 50, maxPercent: 79, message: "" },
  { minPercent: 80, maxPercent: 100, message: "" },
];
