import {
  ASSESSMENT_ANSWER_GRADING_STATUSES,
  QUIZ_GRADING_COMMENT_MAX_LENGTH,
  QUIZ_REVIEW_GRADING_METHODS,
} from "@repo/shared";
import { match } from "ts-pattern";
import { z } from "zod";

import {
  ITEMS_PER_PAGE_OPTIONS,
  type ItemsPerPageOption,
} from "~/components/Pagination/Pagination";

import type { TFunction } from "i18next";
import type { ApiClient } from "~/api/api-client";
import type { GetAnswerDetailsResponse } from "~/api/generated-api";

export type QuizGradingAnswersQuery = NonNullable<
  Parameters<typeof ApiClient.api.quizGradingControllerGetAnswers>[0]
>;

export type QuizGradingStatus = NonNullable<QuizGradingAnswersQuery["status"]>;

export const QUIZ_GRADING_STATUSES = Object.values(
  ASSESSMENT_ANSWER_GRADING_STATUSES,
) satisfies QuizGradingStatus[];

export const QUIZ_GRADING_FILTER_KEYS = ["status", "courseId", "lessonId", "studentId"] as const;

export type QuizGradingFilterKey = (typeof QUIZ_GRADING_FILTER_KEYS)[number];

const DEFAULT_PER_PAGE: ItemsPerPageOption = 20;

export const COMMENT_MAX_LENGTH = QUIZ_GRADING_COMMENT_MAX_LENGTH;

const isStatus = (value: string | null): value is QuizGradingStatus =>
  QUIZ_GRADING_STATUSES.some((status) => status === value);

const uuidOrUndefined = (value: string | null) =>
  value && z.string().uuid().safeParse(value).success ? value : undefined;

const isPerPage = (value: number): value is ItemsPerPageOption =>
  ITEMS_PER_PAGE_OPTIONS.some((option) => option === value);

/** Queue filters live in the URL so returning from the grading view keeps them. */
export const parseQueueSearchParams = (params: URLSearchParams) => {
  const status = params.get("status");
  const page = Number(params.get("page"));
  const perPage = Number(params.get("perPage"));

  return {
    status: isStatus(status) ? status : ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
    courseId: uuidOrUndefined(params.get("courseId")),
    lessonId: uuidOrUndefined(params.get("lessonId")),
    studentId: uuidOrUndefined(params.get("studentId")),
    page: Number.isInteger(page) && page > 0 ? page : 1,
    perPage: isPerPage(perPage) ? perPage : DEFAULT_PER_PAGE,
  } satisfies QuizGradingAnswersQuery;
};

/** Any filter change starts from the first page; picking another course drops its lesson. */
export const updateQueueSearchParams = (
  params: URLSearchParams,
  changes: Partial<Record<QuizGradingFilterKey | "page" | "perPage", string | undefined>>,
) => {
  const next = new URLSearchParams(params);

  if (!("page" in changes)) next.delete("page");
  if ("courseId" in changes && !("lessonId" in changes)) next.delete("lessonId");

  Object.entries(changes).forEach(([key, value]) => {
    if (value) next.set(key, value);
    else next.delete(key);
  });

  return next;
};

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
