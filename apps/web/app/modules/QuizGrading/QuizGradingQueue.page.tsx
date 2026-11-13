import { useNavigate, useSearchParams } from "@remix-run/react";
import { ASSESSMENT_ANSWER_GRADING_STATUSES, sanitizeQuizQuestionTitle } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useQuizGradingAnswers } from "~/api/queries/quiz-grading/useQuizGradingAnswers";
import { useQuizGradingFilterOptions } from "~/api/queries/quiz-grading/useQuizGradingFilterOptions";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { QUIZ_GRADING_HANDLES } from "../../../e2e/data/quiz-grading/handles";

import {
  parseQueueSearchParams,
  QUIZ_GRADING_STATUSES,
  updateQueueSearchParams,
} from "./quizGrading.utils";
import { QuizGradingStatusBadge } from "./QuizGradingStatusBadge";

import type { QuizGradingFilterKey } from "./quizGrading.utils";

const ALL = "all";
const COLUMN_COUNT = 7;

type FilterSelectProps = {
  label: string;
  value: string | undefined;
  allLabel?: string;
  options: { id: string; name: string }[];
  testId: string;
  onChange: (value: string | undefined) => void;
};

function FilterSelect({ label, value, allLabel, options, testId, onChange }: FilterSelectProps) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? undefined : next)}
    >
      <SelectTrigger className="w-full sm:w-56" aria-label={label} data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function QuizGradingQueuePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = parseQueueSearchParams(searchParams);
  const { data, isPending, isError } = useQuizGradingAnswers(query);
  const { data: pendingData, isError: isPendingCountError } = useQuizGradingAnswers({
    status: ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING,
    page: 1,
    perPage: 1,
  });
  const { data: filterOptions, isError: isFilterOptionsError } = useQuizGradingFilterOptions();
  const hasLoadError = isError || isPendingCountError || isFilterOptionsError;

  const answers = data?.data ?? [];
  const lessons = (filterOptions?.lessons ?? []).filter(
    (lesson) => !query.courseId || lesson.courseId === query.courseId,
  );

  const setFilter = (key: QuizGradingFilterKey | "page" | "perPage", value?: string) =>
    setSearchParams(updateQueueSearchParams(searchParams, { [key]: value }), { replace: true });

  const openAnswer = (answerId: string) => navigate(`/quiz-grading/${answerId}`);

  return (
    <PageWrapper breadcrumbs={[{ title: t("quizGrading.title"), href: "/quiz-grading" }]}>
      <div className="flex flex-col gap-4" data-testid={QUIZ_GRADING_HANDLES.QUEUE_PAGE}>
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="h4">{t("quizGrading.title")}</h4>
          {pendingData && (
            <span
              className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700"
              data-testid={QUIZ_GRADING_HANDLES.PENDING_COUNT}
            >
              {t("quizGrading.pendingCount", { count: pendingData.pagination.totalItems })}
            </span>
          )}
        </div>
        {hasLoadError && (
          <p role="alert" className="text-sm text-error-700">
            {t("quizGrading.loadError")}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label={t("quizGrading.filters.status")}
            value={query.status}
            options={QUIZ_GRADING_STATUSES.map((status) => ({
              id: status,
              name: t(`quizGrading.status.${status}`),
            }))}
            testId={QUIZ_GRADING_HANDLES.STATUS_FILTER}
            onChange={(value) => setFilter("status", value)}
          />
          <FilterSelect
            label={t("quizGrading.filters.course")}
            value={query.courseId}
            allLabel={t("quizGrading.filters.allCourses")}
            options={filterOptions?.courses ?? []}
            testId={QUIZ_GRADING_HANDLES.COURSE_FILTER}
            onChange={(value) => setFilter("courseId", value)}
          />
          <FilterSelect
            label={t("quizGrading.filters.lesson")}
            value={query.lessonId}
            allLabel={t("quizGrading.filters.allLessons")}
            options={lessons}
            testId={QUIZ_GRADING_HANDLES.LESSON_FILTER}
            onChange={(value) => setFilter("lessonId", value)}
          />
          <FilterSelect
            label={t("quizGrading.filters.student")}
            value={query.studentId}
            allLabel={t("quizGrading.filters.allStudents")}
            options={filterOptions?.students ?? []}
            testId={QUIZ_GRADING_HANDLES.STUDENT_FILTER}
            onChange={(value) => setFilter("studentId", value)}
          />
        </div>
        <div className="overflow-x-auto">
          <Table className="border bg-neutral-50" aria-label={t("quizGrading.title")}>
            <TableHeader>
              <TableRow>
                <TableHead>{t("quizGrading.columns.question")}</TableHead>
                <TableHead>{t("quizGrading.columns.course")}</TableHead>
                <TableHead>{t("quizGrading.columns.lesson")}</TableHead>
                <TableHead>{t("quizGrading.columns.student")}</TableHead>
                <TableHead>{t("quizGrading.columns.submittedAt")}</TableHead>
                <TableHead>{t("quizGrading.columns.status")}</TableHead>
                <TableHead>{t("quizGrading.columns.points")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody aria-busy={isPending}>
              {!isPending && !isError && !answers.length && (
                <TableRow>
                  <TableCell
                    colSpan={COLUMN_COUNT}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {t("quizGrading.empty")}
                  </TableCell>
                </TableRow>
              )}
              {answers.map((answer) => (
                <TableRow
                  key={answer.id}
                  tabIndex={0}
                  data-testid={QUIZ_GRADING_HANDLES.ROW}
                  onClick={() => openAnswer(answer.id)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && event.key === "Enter") {
                      openAnswer(answer.id);
                    }
                  }}
                  className="cursor-pointer hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <TableCell
                    className="text-sm"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeQuizQuestionTitle(answer.questionTitle),
                    }}
                  />
                  <TableCell className="text-sm">{answer.course.name}</TableCell>
                  <TableCell className="text-sm">{answer.lesson.name}</TableCell>
                  <TableCell className="text-sm">{answer.student.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLocalizedDate(i18n.language, answer.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <QuizGradingStatusBadge status={answer.gradingStatus} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {answer.awardedPoints ?? "—"} / {answer.maximumPoints}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            className="rounded-b-lg border-x border-b bg-neutral-50"
            emptyDataClassName="rounded-b-lg border-x border-b bg-neutral-50"
            totalItems={data?.pagination.totalItems}
            currentPage={query.page}
            itemsPerPage={query.perPage}
            onPageChange={(page) => setFilter("page", String(page))}
            onItemsPerPageChange={(perPage) => setFilter("perPage", perPage)}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
