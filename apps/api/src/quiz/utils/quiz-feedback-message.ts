import { replaceVariables } from "@repo/email-templates";
import { ASSESSMENT_ATTEMPT_GRADING_STATUSES } from "@repo/shared";
import { escape as escapeHtml } from "lodash";

import type { QuizAuthoringFeedbackRange } from "../types/quiz-authoring.types";
import type { AssessmentAttemptGradingStatus } from "@repo/shared";

type ResolveFeedbackRangeMessageArgs = {
  ranges: QuizAuthoringFeedbackRange[];
  scorePercentage: string | null;
  gradingStatus: AssessmentAttemptGradingStatus;
  firstName: string;
};

// Withheld until fully graded because the band depends on the final percentage.
export const resolveQuizFeedbackRangeMessage = ({
  ranges,
  scorePercentage,
  gradingStatus,
  firstName,
}: ResolveFeedbackRangeMessageArgs): string | null => {
  if (gradingStatus !== ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED || scorePercentage === null)
    return null;

  // The learner sees the floored percentage, so the band and {{score}} use the same integer.
  const score = Math.floor(Number(scorePercentage));
  const range = ranges.find(
    ({ minPercent, maxPercent }) => score >= minPercent && score <= maxPercent,
  );

  if (!range?.message) return null;

  // The message is rich-text HTML, so the user-controlled name must not inject markup.
  return replaceVariables(range.message, { firstName: escapeHtml(firstName), score });
};
