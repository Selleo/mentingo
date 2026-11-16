import type { QuizAuthoringFeedbackRange } from "../types/quiz-authoring.types";

export const FEEDBACK_RANGE_ISSUES = {
  NOT_INTEGER: "feedback_range_not_integer",
  OUT_OF_BOUNDS: "feedback_range_out_of_bounds",
  BOUNDS_REVERSED: "feedback_range_bounds_reversed",
  MUST_START_AT_ZERO: "feedback_ranges_must_start_at_zero",
  MUST_END_AT_HUNDRED: "feedback_ranges_must_end_at_hundred",
  GAP_OR_OVERLAP: "feedback_ranges_gap_or_overlap",
} as const;

/**
 * Validates author-defined quiz feedback bands. Bounds are inclusive integer percentages;
 * a non-empty set must partition 0..100 contiguously (no gaps, no overlaps) in display order.
 * An empty set is valid: it means the author configured no custom feedback. Messages are not
 * checked here (an empty message map is allowed for a band).
 */
export const validateFeedbackRanges = (ranges: QuizAuthoringFeedbackRange[]): string[] => {
  if (!ranges.length) return [];

  const issues: string[] = [];

  for (const range of ranges) {
    if (!Number.isInteger(range.minPercent) || !Number.isInteger(range.maxPercent)) {
      issues.push(FEEDBACK_RANGE_ISSUES.NOT_INTEGER);
      continue;
    }

    if (range.minPercent < 0 || range.maxPercent > 100) {
      issues.push(FEEDBACK_RANGE_ISSUES.OUT_OF_BOUNDS);
    }

    if (range.minPercent > range.maxPercent) {
      issues.push(FEEDBACK_RANGE_ISSUES.BOUNDS_REVERSED);
    }
  }

  // Coverage checks only make sense once every bound is a usable integer.
  if (issues.length) return [...new Set(issues)];

  // Submission order is irrelevant: the stored display order is derived from ascending min.
  const sorted = [...ranges].sort((first, second) => first.minPercent - second.minPercent);

  if (sorted[0].minPercent !== 0) issues.push(FEEDBACK_RANGE_ISSUES.MUST_START_AT_ZERO);
  if (sorted[sorted.length - 1].maxPercent !== 100)
    issues.push(FEEDBACK_RANGE_ISSUES.MUST_END_AT_HUNDRED);

  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index].minPercent !== sorted[index - 1].maxPercent + 1) {
      issues.push(FEEDBACK_RANGE_ISSUES.GAP_OR_OVERLAP);
      break;
    }
  }

  return [...new Set(issues)];
};
