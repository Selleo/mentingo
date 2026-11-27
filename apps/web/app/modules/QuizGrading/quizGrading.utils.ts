import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  QUIZ_GRADING_COMMENT_MAX_LENGTH,
  QUIZ_REVIEW_GRADING_METHODS,
} from "@repo/shared";
import { match } from "ts-pattern";
import { z } from "zod";

import type { TFunction } from "i18next";
import type { ApiClient } from "~/api/api-client";
import type { GetAnswerDetailsResponse } from "~/api/generated-api";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

export type QuizGradingAnswersQuery = NonNullable<
  Parameters<typeof ApiClient.api.quizGradingControllerGetAnswers>[0]
>;

export type QuizGradingStatus = NonNullable<QuizGradingAnswersQuery["status"]>;

export const QUIZ_GRADING_STATUSES = Object.values(
  ASSESSMENT_ANSWER_GRADING_STATUSES,
) satisfies QuizGradingStatus[];

export const QUIZ_GRADING_FILTER_KEYS = ["status", "courseId", "lessonId", "studentId"] as const;

export type QuizGradingFilterKey = (typeof QUIZ_GRADING_FILTER_KEYS)[number];

export const QUIZ_GRADING_DEFAULT_PER_PAGE: ItemsPerPageOption = 20;

export const COMMENT_MAX_LENGTH = QUIZ_GRADING_COMMENT_MAX_LENGTH;

export const isQuizGradingStatus = (value: string | undefined): value is QuizGradingStatus =>
  QUIZ_GRADING_STATUSES.some((status) => status === value);

export const isUuid = (value: string) => z.string().uuid().safeParse(value).success;

export const GRADE_VERDICTS = ["passed", "failed"] as const;
export type GradeVerdict = (typeof GRADE_VERDICTS)[number];

type QuizGradingReview = GetAnswerDetailsResponse["data"]["reviews"][number];

// Pass/fail stores full points or 0, so any points mean "passed" even if the question's maximum changes later.
export const reviewVerdict = (review: Pick<QuizGradingReview, "method" | "awardedPoints">) =>
  match(review)
    .returnType<GradeVerdict>()
    .with({ method: QUIZ_REVIEW_GRADING_METHODS.PASS_FAIL }, ({ awardedPoints }) =>
      awardedPoints > 0 ? "passed" : "failed",
    )
    .exhaustive();

export const gradeAnswerFormSchema = (t: TFunction) =>
  z.object({
    verdict: z.enum(GRADE_VERDICTS, {
      errorMap: () => ({ message: t("quizGrading.form.verdictRequired") }),
    }),
    comment: z
      .string()
      .max(COMMENT_MAX_LENGTH, t("quizGrading.form.commentTooLong", { max: COMMENT_MAX_LENGTH })),
  });

export type GradeAnswerFormValues = z.infer<ReturnType<typeof gradeAnswerFormSchema>>;
