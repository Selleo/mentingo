import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

type BreadcrumbsProps = {
  course_id: string;
  lesson_id: string;
  currentCourse: string;
  currentChapter?: string;
  isStudent: boolean;
};

export const LessonPageBreadcrumbs = ({
  course_id,
  lesson_id,
  currentCourse,
  currentChapter,
  isStudent,
}: BreadcrumbsProps) => {
  const { t } = useTranslation();
  return (
    <div className="mb-4 bg-primary-50">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/`}>{t("studentCourseView.breadcrumbs.dashboard")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/courses`}>
            {t(
              isStudent
                ? "studentLessonView.enrolledCourses.breadcrumbs.yourCourses"
                : "studentLessonView.breadcrumbs.availableCourses",
            )}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/course/${course_id}`}>{currentCourse}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={`/course/${course_id}/lesson/${lesson_id}`}>
            {currentChapter}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
