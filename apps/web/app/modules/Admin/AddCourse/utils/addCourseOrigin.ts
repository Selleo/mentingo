import { COURSES_TABLE_PATH } from "~/modules/Courses/utils/coursesView";

export const ADD_COURSE_PARAMS = { CATEGORY_ID: "categoryId", FROM: "from" } as const;

export const ADD_COURSE_ORIGINS = { COURSES: "courses" } as const;

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
