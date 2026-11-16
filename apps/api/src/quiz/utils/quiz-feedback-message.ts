import { replaceVariables } from "@repo/email-templates";
import { ASSESSMENT_ATTEMPT_GRADING_STATUSES } from "@repo/shared";

import type { QuizAuthoringFeedbackRange } from "../types/quiz-authoring.types";
import type { AssessmentAttemptGradingStatus } from "@repo/shared";

type ResolveFeedbackRangeMessageArgs = {
  ranges: QuizAuthoringFeedbackRange[];
  scorePercentage: string | null;
  gradingStatus: AssessmentAttemptGradingStatus;
  firstName: string;
};

/**
 * Picks the author's score band containing the attempt score and interpolates its message.
 * The band depends on the final percentage, so it is withheld until the attempt is fully graded.
 * The learner sees the floored percentage, so the band and `{{score}}` use the same integer.
 */
export const resolveQuizFeedbackRangeMessage = ({
  ranges,
  scorePercentage,
  gradingStatus,
  firstName,
}: ResolveFeedbackRangeMessageArgs): string | null => {
  if (gradingStatus !== ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED || scorePercentage === null)
    return null;

  const score = Math.floor(Number(scorePercentage));
  const range = ranges.find(
    ({ minPercent, maxPercent }) => score >= minPercent && score <= maxPercent,
  );

  if (!range?.message) return null;

  return replaceVariables(range.message, { firstName, score });
};
