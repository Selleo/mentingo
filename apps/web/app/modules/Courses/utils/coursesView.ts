export const COURSES_VIEW_PARAM = "view";

export const COURSES_VIEWS = {
  CATALOGUE: "catalogue",
  TABLE: "table",
} as const;

export type CoursesView = (typeof COURSES_VIEWS)[keyof typeof COURSES_VIEWS];

export const COURSES_CATALOGUE_PATH = "/courses";

export const COURSES_TABLE_PATH = `${COURSES_CATALOGUE_PATH}?${new URLSearchParams({
  [COURSES_VIEW_PARAM]: COURSES_VIEWS.TABLE,
})}`;

export const getRequestedCoursesView = (searchParams: URLSearchParams): CoursesView =>
  searchParams.get(COURSES_VIEW_PARAM) === COURSES_VIEWS.TABLE
    ? COURSES_VIEWS.TABLE
    : COURSES_VIEWS.CATALOGUE;
