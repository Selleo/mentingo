import { COURSE_STATUSES, type CourseStatus } from "@repo/shared";

import { COURSE_ARCHIVE_FILTERS, type CourseArchiveFilter } from "./coursesTable.constants";

export const isCourseStatus = (value: string | null): value is CourseStatus =>
  Object.values(COURSE_STATUSES).some((status) => status === value);

export const isCourseArchiveFilter = (value: string | null): value is CourseArchiveFilter =>
  Object.values(COURSE_ARCHIVE_FILTERS).some((archiveFilter) => archiveFilter === value);
