import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { ALL_COURSES_QUERY_KEY, toCoursesFilterQuery, type CourseParams } from "./useCourses";

type AllCoursesQuery = NonNullable<
  Parameters<typeof ApiClient.api.courseControllerGetAllCourses>[0]
>;

export type CoursesTableSort = NonNullable<AllCoursesQuery["sort"]>;

export type CoursesTableParams = Omit<CourseParams, "sort"> & {
  sort?: CoursesTableSort;
  page: number;
  perPage: number;
};

/** One server-side page of the courses table; sharing the courses key keeps invalidation intact. */
export const coursesTableQueryOptions = (params: CoursesTableParams) => ({
  queryKey: [...ALL_COURSES_QUERY_KEY, "table", params],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetAllCourses({
      ...toCoursesFilterQuery(params),
      ...(params.sort && { sort: params.sort }),
      page: params.page,
      perPage: params.perPage,
    });

    return response.data;
  },
});

export function useCoursesTableSuspense(params: CoursesTableParams) {
  return useSuspenseQuery(coursesTableQueryOptions(params));
}
