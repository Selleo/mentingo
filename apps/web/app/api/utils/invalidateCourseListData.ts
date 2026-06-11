import { AVAILABLE_COURSES_QUERY_KEY } from "~/api/queries/useAvailableCourses";
import { AVAILABLE_COURSE_CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { STUDENT_COURSES_QUERY_KEY } from "~/api/queries/useStudentCourses";
import { queryClient } from "~/api/queryClient";

const COURSE_LIST_QUERY_KEYS = [
  ALL_COURSES_QUERY_KEY,
  AVAILABLE_COURSE_CATEGORIES_QUERY_KEY,
  [AVAILABLE_COURSES_QUERY_KEY],
  [STUDENT_COURSES_QUERY_KEY],
  ["content-creator-courses"],
  ["top-courses"],
] as const;

export async function invalidateCourseListData() {
  await Promise.all(
    COURSE_LIST_QUERY_KEYS.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    ),
  );
}
