import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

import type { GetLessonByIdResponse } from "~/api/generated-api";

type BreadcrumbProps = {
  lessonData: GetLessonByIdResponse["data"];
  courseId: string;
  courseTitle: string;
};

export default function Breadcrumb({ lessonData, courseId, courseTitle }: BreadcrumbProps) {
  const { t } = useTranslation();
  const lessonTitle = lessonData?.title || t("studentLessonView.breadcrumbs.lessonTitle");

  return (
    <div className="bg-primary-50">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/course/${courseId}`}>{courseTitle}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">{lessonTitle}</BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
}
