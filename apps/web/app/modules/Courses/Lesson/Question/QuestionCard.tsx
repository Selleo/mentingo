import { sanitizeQuizQuestionTitle } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { ProgressBadge } from "~/components/Badges/ProgressBadge";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import type { QuizQuestion } from "./types";
import type { ReactNode } from "react";

type QuestionCardProps = {
  questionNumber: number | undefined;
  title: string | undefined;
  questionType:
    | "singleChoice"
    | "multipleChoice"
    | "trueOrFalseQuestion"
    | "oneOrTwoWordSentence"
    | "threeOrFiveWordSentence"
    | "scale_1_5";
  isAwaitingReview?: boolean;
  reviewerFeedback?: QuizQuestion["reviewerFeedback"];
  children: ReactNode;
};

export const QuestionCard = ({
  children,
  questionNumber,
  questionType,
  isAwaitingReview = false,
  reviewerFeedback,
  title = "Question title not provided",
}: QuestionCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="details uppercase text-primary-700">
          {t("studentLessonView.other.question")} {questionNumber ?? 0}
        </div>
        {isAwaitingReview && (
          <span data-testid={LEARNING_HANDLES.QUESTION_AWAITING_REVIEW}>
            <ProgressBadge progress="awaitingReview" />
          </span>
        )}
      </div>
      <div
        className="h6 text-neutral-950"
        dangerouslySetInnerHTML={{ __html: sanitizeQuizQuestionTitle(title) }}
      />
      <div className="body-base text-neutral-900">
        {t(`studentLessonView.other.${questionType}`)}
      </div>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
      {reviewerFeedback && (
        <div className="mt-2 flex flex-col gap-1 rounded-lg bg-neutral-50 p-4">
          <span
            className="body-sm-md text-neutral-950"
            data-testid={LEARNING_HANDLES.REVIEWER_FEEDBACK_POINTS}
          >
            {t("quizGrading.points", {
              points: reviewerFeedback.awardedPoints,
              max: reviewerFeedback.maximumPoints,
            })}
          </span>
          {reviewerFeedback.comment && (
            <p
              className="body-sm whitespace-pre-wrap break-words text-neutral-900"
              data-testid={LEARNING_HANDLES.REVIEWER_FEEDBACK_COMMENT}
            >
              {reviewerFeedback.comment}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
