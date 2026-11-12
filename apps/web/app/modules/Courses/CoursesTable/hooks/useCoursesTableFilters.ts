import { useMemo } from "react";
import { match } from "ts-pattern";

import { useUrlTableState } from "~/hooks/useUrlTableState";

import {
  COURSE_ARCHIVE_FILTERS,
  COURSES_TABLE_DEFAULT_PAGE_SIZE,
  COURSES_TABLE_FILTER_PARAMS,
  COURSES_TABLE_SORT_FIELDS,
  type CourseArchiveFilter,
} from "../coursesTable.constants";
import { isCourseArchiveFilter, isCourseStatus } from "../coursesTable.utils";

import type { CourseStatus } from "@repo/shared";
import type { CourseParams } from "~/api/queries/useCourses";
import type { CoursesTableParams } from "~/api/queries/useCoursesTable";

type UseCoursesTableFiltersOptions = {
  canFilterByManagementState: boolean;
};

const COURSES_TABLE_FILTER_KEYS = [
  COURSES_TABLE_FILTER_PARAMS.CATEGORY,
  COURSES_TABLE_FILTER_PARAMS.STATE,
  COURSES_TABLE_FILTER_PARAMS.ARCHIVE,
] as const;

const toArchiveCourseParams = (
  archive: CourseArchiveFilter,
): Pick<CourseParams, "isArchived" | "includeArchived"> =>
  match(archive)
    .with(COURSE_ARCHIVE_FILTERS.ACTIVE, () => ({ isArchived: false }))
    .with(COURSE_ARCHIVE_FILTERS.ARCHIVED, () => ({ isArchived: true }))
    .with(COURSE_ARCHIVE_FILTERS.ALL, () => ({ includeArchived: true }))
    .exhaustive();

/**
 * Courses table state kept in the URL. State and archive filters are ignored for users who cannot
 * manage courses; an absent archive filter means active courses only.
 */
export function useCoursesTableFilters({
  canFilterByManagementState,
}: UseCoursesTableFiltersOptions) {
  const tableState = useUrlTableState({
    searchParam: COURSES_TABLE_FILTER_PARAMS.TITLE,
    filterKeys: COURSES_TABLE_FILTER_KEYS,
    filterValidators: {
      [COURSES_TABLE_FILTER_PARAMS.STATE]: (value) =>
        canFilterByManagementState && isCourseStatus(value),
      [COURSES_TABLE_FILTER_PARAMS.ARCHIVE]: (value) =>
        canFilterByManagementState && isCourseArchiveFilter(value),
    },
    sortFields: COURSES_TABLE_SORT_FIELDS,
    defaultPerPage: COURSES_TABLE_DEFAULT_PAGE_SIZE,
  });
  const { search: title, filters, sort, page, perPage } = tableState;

  const category = filters.category;
  const stateParam = filters.state ?? null;
  const archiveParam = filters.archive ?? null;
  const state = canFilterByManagementState && isCourseStatus(stateParam) ? stateParam : undefined;
  const archive =
    canFilterByManagementState && isCourseArchiveFilter(archiveParam)
      ? archiveParam
      : COURSE_ARCHIVE_FILTERS.ACTIVE;

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

  return {
    ...tableState,
    courseParams,
    category,
    state,
    archive,
    setCategory: (nextCategory?: string) =>
      tableState.setFilter(COURSES_TABLE_FILTER_PARAMS.CATEGORY, nextCategory),
    setState: (nextState?: CourseStatus) =>
      tableState.setFilter(COURSES_TABLE_FILTER_PARAMS.STATE, nextState),
    setArchive: (nextArchive: CourseArchiveFilter) =>
      tableState.setFilter(
        COURSES_TABLE_FILTER_PARAMS.ARCHIVE,
        nextArchive === COURSE_ARCHIVE_FILTERS.ACTIVE ? undefined : nextArchive,
      ),
  };
}

export type CoursesTableFilters = ReturnType<typeof useCoursesTableFilters>;
