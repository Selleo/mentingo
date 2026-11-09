import { ASSESSMENT_ANSWER_GRADING_STATUSES } from "@repo/shared";
import { z } from "zod";

import {
  ITEMS_PER_PAGE_OPTIONS,
  type ItemsPerPageOption,
} from "~/components/Pagination/Pagination";

import type { TFunction } from "i18next";
import type { ApiClient } from "~/api/api-client";

export type QuizGradingAnswersQuery = NonNullable<
  Parameters<typeof ApiClient.api.quizGradingControllerGetAnswers>[0]
>;

export type QuizGradingStatus = NonNullable<QuizGradingAnswersQuery["status"]>;

export const QUIZ_GRADING_STATUSES = [
  ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
  ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED,
] as const satisfies QuizGradingStatus[];

export const QUIZ_GRADING_FILTER_KEYS = ["status", "courseId", "lessonId", "studentId"] as const;

export type QuizGradingFilterKey = (typeof QUIZ_GRADING_FILTER_KEYS)[number];

const DEFAULT_PER_PAGE: ItemsPerPageOption = 20;
export const COMMENT_MAX_LENGTH = 5000;

const isStatus = (value: string | null): value is QuizGradingStatus =>
  QUIZ_GRADING_STATUSES.some((status) => status === value);

const isPerPage = (value: number): value is ItemsPerPageOption =>
  ITEMS_PER_PAGE_OPTIONS.some((option) => option === value);

/** Queue filters live in the URL so returning from the grading view keeps them. */
export const parseQueueSearchParams = (params: URLSearchParams) => {
  const status = params.get("status");
  const page = Number(params.get("page"));
  const perPage = Number(params.get("perPage"));

  return {
    status: isStatus(status) ? status : ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
    courseId: params.get("courseId") ?? undefined,
    lessonId: params.get("lessonId") ?? undefined,
    studentId: params.get("studentId") ?? undefined,
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

export const gradeAnswerFormSchema = (t: TFunction, maximumPoints: number) => {
  const pointsMessage = t("quizGrading.form.pointsRange", { max: maximumPoints });

  return z.object({
    awardedPoints: z
      .string()
      .trim()
      .regex(/^\d+$/, pointsMessage)
      .refine((value) => Number(value) <= maximumPoints, pointsMessage),
    comment: z
      .string()
      .max(COMMENT_MAX_LENGTH, t("quizGrading.form.commentTooLong", { max: COMMENT_MAX_LENGTH })),
  });
};

export type GradeAnswerFormValues = z.infer<ReturnType<typeof gradeAnswerFormSchema>>;
