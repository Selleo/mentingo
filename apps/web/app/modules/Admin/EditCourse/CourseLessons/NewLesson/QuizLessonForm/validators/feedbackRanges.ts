import type { QuizFeedbackRange } from "../QuizLessonForm.types";

export const FEEDBACK_RANGE_VALIDATION_KEYS = {
  notInteger: "adminCourseView.curriculum.lesson.validation.feedbackRangeNotInteger",
  outOfBounds: "adminCourseView.curriculum.lesson.validation.feedbackRangeOutOfBounds",
  boundsReversed: "adminCourseView.curriculum.lesson.validation.feedbackRangeBoundsReversed",
  mustStartAtZero: "adminCourseView.curriculum.lesson.validation.feedbackRangesMustStartAtZero",
  mustEndAtHundred: "adminCourseView.curriculum.lesson.validation.feedbackRangesMustEndAtHundred",
  gapOrOverlap: "adminCourseView.curriculum.lesson.validation.feedbackRangesGapOrOverlap",
} as const;

export type FeedbackRangeIssue = keyof typeof FEEDBACK_RANGE_VALIDATION_KEYS;

// Mirrors the server validator (apps/api quiz-feedback-range.validator.ts): an empty set is valid
// (no custom feedback); a non-empty set must partition 0..100 contiguously with inclusive integer
// bounds, in any submission order. Messages are not checked here.
export const collectFeedbackRangeIssues = (ranges: QuizFeedbackRange[]): FeedbackRangeIssue[] => {
  if (!ranges.length) return [];

  const issues: FeedbackRangeIssue[] = [];

  for (const range of ranges) {
    if (!Number.isInteger(range.minPercent) || !Number.isInteger(range.maxPercent)) {
      issues.push("notInteger");
      continue;
    }

    if (range.minPercent < 0 || range.maxPercent > 100) issues.push("outOfBounds");
    if (range.minPercent > range.maxPercent) issues.push("boundsReversed");
  }

  // Coverage checks only make sense once every bound is a usable integer.
  if (issues.length) return [...new Set(issues)];

  const sorted = [...ranges].sort((first, second) => first.minPercent - second.minPercent);

  if (sorted[0].minPercent !== 0) issues.push("mustStartAtZero");
  if (sorted[sorted.length - 1].maxPercent !== 100) issues.push("mustEndAtHundred");

  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index].minPercent !== sorted[index - 1].maxPercent + 1) {
      issues.push("gapOrOverlap");
      break;
    }
  }

  return [...new Set(issues)];
};
