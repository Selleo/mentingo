import { useSearchParams } from "@remix-run/react";
import { functionalUpdate, type SortingState, type Updater } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { match } from "ts-pattern";

import { useDebounce } from "~/hooks/useDebounce";

import {
  COURSE_ARCHIVE_FILTERS,
  COURSES_TABLE_DEFAULT_PAGE_SIZE,
  COURSES_TABLE_URL_PARAMS,
  type CourseArchiveFilter,
  type CoursesTableUrlParam,
} from "../coursesTable.constants";
import {
  isCourseArchiveFilter,
  isCourseStatus,
  isCoursesTablePageSize,
  parsePageNumber,
  toCoursesTableSort,
  toCoursesTableSorting,
} from "../coursesTable.utils";

import type { CourseStatus } from "@repo/shared";
import type { CourseParams } from "~/api/queries/useCourses";
import type { CoursesTableParams } from "~/api/queries/useCoursesTable";

type UseCoursesTableFiltersOptions = {
  canFilterByManagementState: boolean;
};

type CoursesTableUrlValues = Partial<Record<CoursesTableUrlParam, string>>;

const toArchiveCourseParams = (
  archive: CourseArchiveFilter,
): Pick<CourseParams, "isArchived" | "includeArchived"> =>
  match(archive)
    .with(COURSE_ARCHIVE_FILTERS.ACTIVE, () => ({ isArchived: false }))
    .with(COURSE_ARCHIVE_FILTERS.ARCHIVED, () => ({ isArchived: true }))
    .with(COURSE_ARCHIVE_FILTERS.ALL, () => ({ includeArchived: true }))
    .exhaustive();

/**
 * Keeps the courses table filters, sorting and page in the URL so a view can be shared. Narrowing
 * the list returns to the first page. State and archive filters are ignored for users who cannot
 * manage courses.
 */
export function useCoursesTableFilters({
  canFilterByManagementState,
}: UseCoursesTableFiltersOptions) {
  const [searchParams, setSearchParams] = useSearchParams();

  const title = searchParams.get(COURSES_TABLE_URL_PARAMS.TITLE) ?? "";
  const category = searchParams.get(COURSES_TABLE_URL_PARAMS.CATEGORY) ?? undefined;
  const stateParam = searchParams.get(COURSES_TABLE_URL_PARAMS.STATE);
  const archiveParam = searchParams.get(COURSES_TABLE_URL_PARAMS.ARCHIVE);
  const sortParam = searchParams.get(COURSES_TABLE_URL_PARAMS.SORT);
  const perPageParam = Number(searchParams.get(COURSES_TABLE_URL_PARAMS.PER_PAGE));

  const state = canFilterByManagementState && isCourseStatus(stateParam) ? stateParam : undefined;
  const archive =
    canFilterByManagementState && isCourseArchiveFilter(archiveParam)
      ? archiveParam
      : COURSE_ARCHIVE_FILTERS.ACTIVE;
  const page = parsePageNumber(searchParams.get(COURSES_TABLE_URL_PARAMS.PAGE));
  const perPage = isCoursesTablePageSize(perPageParam)
    ? perPageParam
    : COURSES_TABLE_DEFAULT_PAGE_SIZE;
  const sorting = useMemo(() => toCoursesTableSorting(sortParam), [sortParam]);
  const sort = toCoursesTableSort(sorting);

  const [titleInput, setTitleInput] = useState(title);
  const debouncedTitle = useDebounce(titleInput.trim());

  const updateUrlParams = (values: CoursesTableUrlValues) => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);

        Object.entries(values).forEach(([param, value]) => {
          if (value) nextParams.set(param, value);
          else nextParams.delete(param);
        });

        return nextParams;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const updateListParams = (values: CoursesTableUrlValues) =>
    updateUrlParams({ ...values, [COURSES_TABLE_URL_PARAMS.PAGE]: undefined });

  useEffect(() => {
    setTitleInput((currentInput) => (currentInput.trim() === title ? currentInput : title));
  }, [title]);

  useEffect(() => {
    if (debouncedTitle === title) return;

    updateListParams({ [COURSES_TABLE_URL_PARAMS.TITLE]: debouncedTitle });
    // Only typing writes the title; URL changes flow back through the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle]);

  const courseParams = useMemo<Omit<CoursesTableParams, "language">>(
    () => ({
      ...(title && { title }),
      ...(category && { category }),
      ...(state && { state }),
      ...toArchiveCourseParams(archive),
      ...(sort && { sort }),
      page,
      perPage,
    }),
    [title, category, state, archive, sort, page, perPage],
  );

  const activeFilterCount = [
    title,
    category,
    state,
    archive !== COURSE_ARCHIVE_FILTERS.ACTIVE,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setTitleInput("");
    updateListParams({
      [COURSES_TABLE_URL_PARAMS.TITLE]: undefined,
      [COURSES_TABLE_URL_PARAMS.CATEGORY]: undefined,
      [COURSES_TABLE_URL_PARAMS.STATE]: undefined,
      [COURSES_TABLE_URL_PARAMS.ARCHIVE]: undefined,
    });
  };

  return {
    courseParams,
    titleInput,
    category,
    state,
    archive,
    sorting,
    page,
    perPage,
    activeFilterCount,
    setTitleInput,
    setCategory: (nextCategory?: string) =>
      updateListParams({ [COURSES_TABLE_URL_PARAMS.CATEGORY]: nextCategory }),
    setState: (nextState?: CourseStatus) =>
      updateListParams({ [COURSES_TABLE_URL_PARAMS.STATE]: nextState }),
    setArchive: (nextArchive: CourseArchiveFilter) =>
      updateListParams({
        [COURSES_TABLE_URL_PARAMS.ARCHIVE]:
          nextArchive === COURSE_ARCHIVE_FILTERS.ACTIVE ? undefined : nextArchive,
      }),
    setSorting: (sortingUpdater: Updater<SortingState>) =>
      updateListParams({
        [COURSES_TABLE_URL_PARAMS.SORT]: toCoursesTableSort(
          functionalUpdate(sortingUpdater, sorting),
        ),
      }),
    setPage: (nextPage: number) =>
      updateUrlParams({
        [COURSES_TABLE_URL_PARAMS.PAGE]: nextPage > 1 ? String(nextPage) : undefined,
      }),
    setPerPage: (nextPerPage: string) =>
      updateListParams({
        [COURSES_TABLE_URL_PARAMS.PER_PAGE]:
          Number(nextPerPage) === COURSES_TABLE_DEFAULT_PAGE_SIZE ? undefined : nextPerPage,
      }),
    resetFilters,
  };
}

export type CoursesTableFilters = ReturnType<typeof useCoursesTableFilters>;
