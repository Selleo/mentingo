import { Link } from "@remix-run/react";
import { ArrowLeft, FileText, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { setPageTitle } from "~/utils/setPageTitle";

import { COURSE_TYPE_SELECTOR_HANDLES } from "../../../../e2e/data/courses/handles";

import { CourseTypeCard } from "./components/CourseTypeCard";

import type { MetaFunction } from "@remix-run/react";
import type { LucideIcon } from "lucide-react";

type CourseTypeOption = {
  id: "standard" | "scorm";
  href: string;
  icon: LucideIcon;
  featureKeys: string[];
  badgeKey?: string;
};

const COURSE_TYPE_OPTIONS: CourseTypeOption[] = [
  {
    id: "standard",
    href: "/admin/beta-courses/new/standard",
    icon: FileText,
    featureKeys: [
      "adminCourseTypeSelector.standard.features.authoring",
      "adminCourseTypeSelector.standard.features.curriculum",
      "adminCourseTypeSelector.standard.features.translations",
      "adminCourseTypeSelector.standard.features.settings",
    ],
  },
  {
    id: "scorm",
    href: "/admin/courses/new-scorm",
    icon: Package,
    badgeKey: "adminCourseTypeSelector.scorm.badge",
    featureKeys: [
      "adminCourseTypeSelector.scorm.features.import",
      "adminCourseTypeSelector.scorm.features.tracking",
      "adminCourseTypeSelector.scorm.features.structure",
      "adminCourseTypeSelector.scorm.features.future",
    ],
  },
];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

const CourseTypeSelectorPage = () => {
  const { t } = useTranslation();

  return (
    <main
      data-testid={COURSE_TYPE_SELECTOR_HANDLES.PAGE}
      className="min-h-screen bg-white px-6 py-8 md:px-10 lg:px-16"
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center">
        <BreadcrumbList className="mb-8">
          <BreadcrumbItem>
            <BreadcrumbLink asChild className="body-base-md text-primary-800">
              <Button asChild variant="outline" className="mr-2 w-min">
                <Link to="/admin/courses" data-testid={COURSE_TYPE_SELECTOR_HANDLES.BACK_BUTTON}>
                  <ArrowLeft className="mr-2 size-3" />
                  {t("adminCourseTypeSelector.back")}
                </Link>
              </Button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink
              href="/admin/courses"
              className="text-neutral-850 body-base-md hover:text-neutral-850"
            >
              {t("adminCourseView.settings.breadcrumbs.myCourses")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="body-base-md text-neutral-950">
            {t("adminCourseView.settings.breadcrumbs.createNew")}
          </BreadcrumbItem>
        </BreadcrumbList>

        <div className="mb-8 max-w-3xl">
          <p className="body-base-md mb-3 text-primary-800">
            {t("adminCourseTypeSelector.eyebrow")}
          </p>
          <h1 className="h2 text-neutral-950">{t("adminCourseTypeSelector.title")}</h1>
          <p className="body-lg mt-4 text-neutral-700">{t("adminCourseTypeSelector.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {COURSE_TYPE_OPTIONS.map((option) => (
            <CourseTypeCard
              key={option.id}
              title={t(`adminCourseTypeSelector.${option.id}.title`)}
              description={t(`adminCourseTypeSelector.${option.id}.description`)}
              features={option.featureKeys.map((featureKey) => t(featureKey))}
              href={option.href}
              icon={option.icon}
              badge={option.badgeKey ? t(option.badgeKey) : undefined}
              accent={option.id}
              testId={
                option.id === "standard"
                  ? COURSE_TYPE_SELECTOR_HANDLES.STANDARD_CARD
                  : COURSE_TYPE_SELECTOR_HANDLES.SCORM_CARD
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
};

export default CourseTypeSelectorPage;
