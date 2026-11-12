export const COURSES_TABLE_FILTER_PARAMS = {
  TITLE: "title",
  CATEGORY: "category",
  STATE: "state",
  ARCHIVE: "archive",
} as const;

export const COURSE_ARCHIVE_FILTERS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  ALL: "all",
} as const;

export type CourseArchiveFilter =
  (typeof COURSE_ARCHIVE_FILTERS)[keyof typeof COURSE_ARCHIVE_FILTERS];

export const COURSES_TABLE_ANY_FILTER_VALUE = "__all__";

/** Table columns sortable on the server, mapped to the API sort field they order by. */
export const COURSES_TABLE_SORT_FIELDS = {
  title: "title",
  author: "author",
  category: "category",
  createdAt: "creationDate",
} as const;

export const COURSES_TABLE_DEFAULT_PAGE_SIZE = 20;

/** The query an unfiltered table runs; prefetching it makes the view switch instant. */
export const COURSES_TABLE_DEFAULT_PARAMS = {
  isArchived: false,
  page: 1,
  perPage: COURSES_TABLE_DEFAULT_PAGE_SIZE,
} as const;
