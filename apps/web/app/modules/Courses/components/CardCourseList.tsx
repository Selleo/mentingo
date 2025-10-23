import CourseCard from "./CourseCard";

import type { GetAvailableCoursesResponse } from "~/api/generated-api";

type CardCourseListProps = {
  availableCourses?: GetAvailableCoursesResponse["data"];
};

export const CardCourseList = ({ availableCourses }: CardCourseListProps) => {
  return (
    <div className="flex flex-wrap gap-6 *:h-auto">
      {availableCourses &&
        availableCourses.map((course, index) => {
          if (course.enrolled) return null;

          return <CourseCard {...course} key={course.id} isFirst={index === 0} />;
        })}
    </div>
  );
};
