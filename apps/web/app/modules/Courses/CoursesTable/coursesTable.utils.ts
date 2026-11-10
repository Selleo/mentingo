import { COURSE_STATUSES, type CourseStatus } from "@repo/shared";

import {
  ITEMS_PER_PAGE_OPTIONS,
  type ItemsPerPageOption,
} from "~/components/Pagination/Pagination";

import {
  COURSE_ARCHIVE_FILTERS,
  COURSES_TABLE_SORT_FIELDS,
  type CourseArchiveFilter,
  type CoursesTableSortColumn,
} from "./coursesTable.constants";

import type { SortingState } from "@tanstack/react-table";
import type { CoursesTableSort } from "~/api/queries/useCoursesTable";

export const isCourseStatus = (value: string | null): value is CourseStatus =>
  Object.values(COURSE_STATUSES).some((status) => status === value);

export const isCourseArchiveFilter = (value: string | null): value is CourseArchiveFilter =>
  Object.values(COURSE_ARCHIVE_FILTERS).some((archiveFilter) => archiveFilter === value);

export const isCoursesTableSortColumn = (value: string): value is CoursesTableSortColumn =>
  Object.keys(COURSES_TABLE_SORT_FIELDS).includes(value);

export const isCoursesTablePageSize = (value: number): value is ItemsPerPageOption =>
  ITEMS_PER_PAGE_OPTIONS.some((pageSize) => pageSize === value);

export const parsePageNumber = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
};

/** Reads a `sort` URL value such as `-creationDate` back into table sorting state. */
export const toCoursesTableSorting = (sortParam: string | null): SortingState => {
  const isDescending = Boolean(sortParam?.startsWith("-"));
  const sortField = isDescending ? sortParam?.slice(1) : sortParam;
  const sortColumn = Object.entries(COURSES_TABLE_SORT_FIELDS).find(
    ([, field]) => field === sortField,
  )?.[0];

  return sortColumn ? [{ id: sortColumn, desc: isDescending }] : [];
};

export const toCoursesTableSort = (sorting: SortingState): CoursesTableSort | undefined => {
  const [firstSort] = sorting;
  if (!firstSort || !isCoursesTableSortColumn(firstSort.id)) return undefined;

  const sortField = COURSES_TABLE_SORT_FIELDS[firstSort.id];

  return firstSort.desc ? (`-${sortField}` as const) : sortField;
};
