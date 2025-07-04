import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

type BreadcrumbsProps = {
  isStudent?: boolean;
};

export const CoursesPageBreadcrumbs = ({ isStudent }: BreadcrumbsProps) => {
  const { t } = useTranslation();
  return (
    <div className="mb-4 bg-primary-50">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/`}>
            {t("studentCoursesView.breadcrumbs.dashboard")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={`/courses`}>
            {t(
              isStudent
                ? "studentCoursesView.enrolledCourses.breadcrumbs.yourCourses"
                : "studentCoursesView.breadcrumbs.availableCourses",
            )}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
