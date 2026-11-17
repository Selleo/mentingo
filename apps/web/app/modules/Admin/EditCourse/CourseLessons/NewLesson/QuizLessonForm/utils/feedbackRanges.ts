import type { QuizFeedbackRange } from "../QuizLessonForm.types";

// Defaults are only for new quizzes; an edited quiz without bands must stay without bands.
export const toFormFeedbackRanges = (ranges: QuizFeedbackRange[] = []): QuizFeedbackRange[] =>
  ranges.map(({ id, minPercent, maxPercent, message }) => ({
    id,
    minPercent,
    maxPercent,
    message: message ?? "",
  }));

// Returns null when the last band is a single point and cannot be split.
export const appendFeedbackRange = (ranges: QuizFeedbackRange[]): QuizFeedbackRange[] | null => {
  const lastRange = ranges.at(-1);

  if (!lastRange) return [{ minPercent: 0, maxPercent: 100, message: "" }];

  if (lastRange.maxPercent < 100)
    return [...ranges, { minPercent: lastRange.maxPercent + 1, maxPercent: 100, message: "" }];

  if (lastRange.minPercent >= lastRange.maxPercent) return null;

  const splitPercent = Math.floor((lastRange.minPercent + lastRange.maxPercent) / 2);

  return [
    ...ranges.slice(0, -1),
    { ...lastRange, maxPercent: splitPercent },
    { minPercent: splitPercent + 1, maxPercent: 100, message: "" },
  ];
};
