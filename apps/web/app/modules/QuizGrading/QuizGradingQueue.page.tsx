import { useNavigate } from "@remix-run/react";
import { ASSESSMENT_ANSWER_GRADING_STATUSES } from "@repo/shared";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useQuizGradingAnswers } from "~/api/queries/quiz-grading/useQuizGradingAnswers";
import { useQuizGradingFilterOptions } from "~/api/queries/quiz-grading/useQuizGradingFilterOptions";
import {
  type ActiveTableFilter,
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableToolbar,
  useClampedPage,
} from "~/components/DataTable";
import { OptionPicker, type PickerOption } from "~/components/OptionPicker/OptionPicker";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper";
import { useUrlTableState } from "~/hooks/useUrlTableState";

import { QUIZ_GRADING_HANDLES } from "../../../e2e/data/quiz-grading/handles";

import {
  isQuizGradingStatus,
  isUuid,
  QUIZ_GRADING_DEFAULT_PER_PAGE,
  QUIZ_GRADING_FILTER_KEYS,
  QUIZ_GRADING_STATUSES,
} from "./quizGrading.utils";
import { getQuizGradingQueueColumns } from "./quizGradingQueue.columns";

import type { QuizGradingFilterKey } from "./quizGrading.utils";

const ALL = "__all__";

export default function QuizGradingQueuePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const tableState = useUrlTableState({
    filterKeys: QUIZ_GRADING_FILTER_KEYS,
    filterValidators: {
      status: isQuizGradingStatus,
      courseId: isUuid,
      lessonId: isUuid,
      studentId: isUuid,
    },
    defaultPerPage: QUIZ_GRADING_DEFAULT_PER_PAGE,
  });
  const { courseId, lessonId, studentId } = tableState.filters;
  const status = isQuizGradingStatus(tableState.filters.status)
    ? tableState.filters.status
    : ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING;

  const { data, isPending, isFetching, isError } = useQuizGradingAnswers({
    status,
    courseId,
    lessonId,
    studentId,
    page: tableState.page,
    perPage: tableState.perPage,
  });
  const { data: filterOptions, isError: isFilterOptionsError } = useQuizGradingFilterOptions();
  const hasLoadError = isError || isFilterOptionsError;

  useClampedPage({
    page: tableState.page,
    perPage: tableState.perPage,
    totalItems: data?.pagination.totalItems,
    setPage: tableState.setPage,
  });

  const toPickerOptions = (options: { id: string; name: string }[] = []) =>
    options.map(({ id, name }) => ({ id, label: name }));

  const statusOptions = QUIZ_GRADING_STATUSES.map((gradingStatus) => ({
    id: gradingStatus,
    label: t(`quizGrading.status.${gradingStatus}`),
  }));
  const courseOptions = toPickerOptions(filterOptions?.courses);
  const lessonOptions = toPickerOptions(
    filterOptions?.lessons.filter((lesson) => !courseId || lesson.courseId === courseId),
  );
  const studentOptions = toPickerOptions(filterOptions?.students);

  const setStatus = (nextStatus: string) =>
    tableState.setFilter(
      "status",
      nextStatus === ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING ? undefined : nextStatus,
    );
  const setCourse = (nextCourseId?: string) =>
    tableState.setFilters({ courseId: nextCourseId, lessonId: undefined });

  const filterLabel = (options: PickerOption[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id;

  const activeFilterDefinitions: {
    key: QuizGradingFilterKey;
    value: string | undefined;
    label: string;
    options: PickerOption[];
    onRemove: () => void;
  }[] = [
    {
      key: "status",
      value: tableState.filters.status,
      label: t("quizGrading.filters.status"),
      options: statusOptions,
      onRemove: () => setStatus(ASSESSMENT_ANSWER_GRADING_STATUSES.PENDING),
    },
    {
      key: "courseId",
      value: courseId,
      label: t("quizGrading.filters.course"),
      options: courseOptions,
      onRemove: () => setCourse(undefined),
    },
    {
      key: "lessonId",
      value: lessonId,
      label: t("quizGrading.filters.lesson"),
      options: lessonOptions,
      onRemove: () => tableState.setFilter("lessonId", undefined),
    },
    {
      key: "studentId",
      value: studentId,
      label: t("quizGrading.filters.student"),
      options: studentOptions,
      onRemove: () => tableState.setFilter("studentId", undefined),
    },
  ];
  const activeFilters: ActiveTableFilter[] = activeFilterDefinitions.flatMap(
    ({ key, value, label, options, onRemove }) =>
      value ? [{ id: key, label, value: filterLabel(options, value), onRemove }] : [],
  );

  const columns = useMemo(
    () => getQuizGradingQueueColumns({ t, language: i18n.language }),
    [t, i18n.language],
  );

  const table = useReactTable({
    getRowId: (answer) => answer.id,
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageWrapper breadcrumbs={[{ title: t("quizGrading.title"), href: "/quiz-grading" }]}>
      <div className="flex flex-col gap-6" data-testid={QUIZ_GRADING_HANDLES.QUEUE_PAGE}>
        <PageHeader title={t("quizGrading.title")} />

        {hasLoadError && (
          <p role="alert" className="text-sm text-error-700">
            {t("quizGrading.loadError")}
          </p>
        )}

        <DataTableCard>
          <DataTableToolbar
            activeFilters={activeFilters}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          >
            <OptionPicker
              label={t("quizGrading.filters.status")}
              placeholder={t("quizGrading.filters.status")}
              className="w-full sm:w-44"
              options={statusOptions}
              selectedIds={[status]}
              testId={QUIZ_GRADING_HANDLES.STATUS_FILTER}
              onToggle={({ id }) => setStatus(id)}
            />
            <OptionPicker
              label={t("quizGrading.filters.course")}
              placeholder={t("quizGrading.filters.allCourses")}
              className="w-full sm:w-56"
              options={[{ id: ALL, label: t("quizGrading.filters.allCourses") }, ...courseOptions]}
              selectedIds={[courseId ?? ALL]}
              testId={QUIZ_GRADING_HANDLES.COURSE_FILTER}
              onToggle={({ id }) => setCourse(id === ALL ? undefined : id)}
            />
            <OptionPicker
              label={t("quizGrading.filters.lesson")}
              placeholder={t("quizGrading.filters.allLessons")}
              className="w-full sm:w-56"
              options={[{ id: ALL, label: t("quizGrading.filters.allLessons") }, ...lessonOptions]}
              selectedIds={[lessonId ?? ALL]}
              testId={QUIZ_GRADING_HANDLES.LESSON_FILTER}
              onToggle={({ id }) => tableState.setFilter("lessonId", id === ALL ? undefined : id)}
            />
            <OptionPicker
              label={t("quizGrading.filters.student")}
              placeholder={t("quizGrading.filters.allStudents")}
              className="w-full sm:w-56"
              options={[
                { id: ALL, label: t("quizGrading.filters.allStudents") },
                ...studentOptions,
              ]}
              selectedIds={[studentId ?? ALL]}
              testId={QUIZ_GRADING_HANDLES.STUDENT_FILTER}
              onToggle={({ id }) => tableState.setFilter("studentId", id === ALL ? undefined : id)}
            />
          </DataTableToolbar>

          <DataTable
            table={table}
            isRefreshing={isFetching && !isPending}
            onRowClick={(row) => navigate(`/quiz-grading/${row.original.id}`)}
            testId={QUIZ_GRADING_HANDLES.TABLE}
            getRowTestId={() => QUIZ_GRADING_HANDLES.ROW}
            emptyState={
              !isPending && (
                <DataTableEmptyState
                  testId={QUIZ_GRADING_HANDLES.EMPTY_STATE}
                  title={t("quizGrading.empty")}
                  onResetFilters={
                    tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                  }
                />
              )
            }
          />

          <DataTablePagination
            totalItems={data?.pagination.totalItems}
            itemsPerPage={tableState.perPage}
            currentPage={tableState.page}
            onPageChange={tableState.setPage}
            onItemsPerPageChange={tableState.setPerPage}
          />
        </DataTableCard>
      </div>
    </PageWrapper>
  );
}
