import { match } from "ts-pattern";

import { CardCourseList } from "./CardCourseList";
import { TableCourseList } from "./TableCourseList";

import type { GetAvailableCoursesResponse } from "~/api/generated-api";
import type { CourseListLayout } from "~/types/shared";

export const CourseList: React.FC<{
  availableCourses: GetAvailableCoursesResponse["data"];
  courseListLayout: CourseListLayout;
}> = ({ availableCourses, courseListLayout }) =>
    match(courseListLayout)
      .with("card", () => <CardCourseList availableCourses={availableCourses} />)
      .with("table", () => <TableCourseList availableCourses={availableCourses} />)
      .exhaustive();
