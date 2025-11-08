import { CardCourseList } from "./CardCourseList";

import type { GetAvailableCoursesResponse } from "~/api/generated-api";

export const CourseList: React.FC<{
  availableCourses: GetAvailableCoursesResponse["data"];
}> = ({ availableCourses }) => <CardCourseList availableCourses={availableCourses} />;
