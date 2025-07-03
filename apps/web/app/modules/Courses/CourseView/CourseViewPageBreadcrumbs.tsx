import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

type BreadcrumbsProps = {
  id: string;
  title: string;
};

export const CourseViewPageBreadcrumbs = ({ id, title }: BreadcrumbsProps) => {
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
            {t("studentCourseView.breadcrumbs.availableCourses")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={`/course/${id}`}>{title}</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
