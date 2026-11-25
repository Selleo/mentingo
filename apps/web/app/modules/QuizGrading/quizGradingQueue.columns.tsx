import { sanitizeQuizQuestionTitle } from "@repo/shared";

import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { QuizGradingStatusBadge } from "./QuizGradingStatusBadge";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { GetAnswersResponse } from "~/api/generated-api";

export type QuizGradingQueueAnswer = GetAnswersResponse["data"][number];

type QuizGradingQueueColumnsOptions = {
  t: TFunction;
  language: string;
};

export const getQuizGradingQueueColumns = ({
  t,
  language,
}: QuizGradingQueueColumnsOptions): ColumnDef<QuizGradingQueueAnswer>[] => [
  {
    id: "question",
    header: t("quizGrading.columns.question"),
    cell: ({ row }) => (
      <span
        className="line-clamp-2 text-sm font-medium text-neutral-950"
        dangerouslySetInnerHTML={{ __html: sanitizeQuizQuestionTitle(row.original.questionTitle) }}
      />
    ),
  },
  {
    id: "course",
    header: t("quizGrading.columns.course"),
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm text-neutral-950">{row.original.course.name}</span>
        <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {row.original.lesson.name}
        </span>
      </div>
    ),
  },
  {
    id: "student",
    header: t("quizGrading.columns.student"),
    cell: ({ row }) => <span className="text-sm">{row.original.student.name}</span>,
  },
  {
    accessorKey: "submittedAt",
    header: t("quizGrading.columns.submittedAt"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {formatLocalizedDate(language, row.original.submittedAt)}
      </span>
    ),
  },
  {
    accessorKey: "gradingStatus",
    header: t("quizGrading.columns.status"),
    cell: ({ row }) => <QuizGradingStatusBadge status={row.original.gradingStatus} />,
  },
  {
    id: "points",
    header: t("quizGrading.columns.points"),
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm tabular-nums">
        {row.original.awardedPoints ?? "—"} / {row.original.maximumPoints}
      </span>
    ),
  },
];
