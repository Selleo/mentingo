import { COURSES_TABLE_PATH } from "~/modules/Courses/utils/coursesView";

export const ADD_COURSE_PARAMS = { CATEGORY_ID: "categoryId", FROM: "from" } as const;

export const ADD_COURSE_ORIGINS = { COURSES: "courses" } as const;

export const STANDARD_COURSE_CREATION_PATH = "/admin/beta-courses/new/standard";
export const AI_COURSE_CREATION_PATH = `${STANDARD_COURSE_CREATION_PATH}/ai`;

const COURSES_PATH = "/courses";

export const buildAddCourseFromCategoryPath = (categoryId: string) =>
  `/admin/beta-courses/new?${new URLSearchParams({
    [ADD_COURSE_PARAMS.CATEGORY_ID]: categoryId,
    [ADD_COURSE_PARAMS.FROM]: ADD_COURSE_ORIGINS.COURSES,
  })}`;

/** Where "back" leads from course creation: the catalogue when started there, else the table. */
export const getAddCourseExitPath = (searchParams: URLSearchParams) =>
  searchParams.get(ADD_COURSE_PARAMS.FROM) === ADD_COURSE_ORIGINS.COURSES
    ? COURSES_PATH
    : COURSES_TABLE_PATH;

/** Keeps the category preset and origin while moving between course creation steps. */
export const withAddCourseContext = (path: string, searchParams: URLSearchParams) => {
  const context = new URLSearchParams();

  Object.values(ADD_COURSE_PARAMS).forEach((param) => {
    const value = searchParams.get(param);
    if (value) context.set(param, value);
  });

  const query = context.toString();

  return query ? `${path}?${query}` : path;
};

/** Keeps an open draft available when switching between the form and its drawer. */
export const withCourseDraft = (path: string, searchParams: URLSearchParams) => {
  const destination = withAddCourseContext(path, searchParams);
  const draftId = searchParams.get("draftId");
  const sessionId = searchParams.get("sessionId");
  if (!draftId || !sessionId) return destination;

  const draft = new URLSearchParams({ draftId, sessionId });
  return `${destination}${destination.includes("?") ? "&" : "?"}${draft}`;
};
