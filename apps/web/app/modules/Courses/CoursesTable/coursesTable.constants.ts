export const COURSES_TABLE_URL_PARAMS = {
  TITLE: "title",
  CATEGORY: "category",
  STATE: "state",
  ARCHIVE: "archive",
  SORT: "sort",
  PAGE: "page",
  PER_PAGE: "perPage",
} as const;

export type CoursesTableUrlParam =
  (typeof COURSES_TABLE_URL_PARAMS)[keyof typeof COURSES_TABLE_URL_PARAMS];

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

export type CoursesTableSortColumn = keyof typeof COURSES_TABLE_SORT_FIELDS;

export const COURSES_TABLE_DEFAULT_PAGE_SIZE = 20;

/** The query an unfiltered table runs; prefetching it makes the view switch instant. */
export const COURSES_TABLE_DEFAULT_PARAMS = {
  isArchived: false,
  page: 1,
  perPage: COURSES_TABLE_DEFAULT_PAGE_SIZE,
} as const;
