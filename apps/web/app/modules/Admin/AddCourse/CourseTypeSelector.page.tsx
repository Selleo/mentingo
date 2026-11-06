import { useSearchParams } from "@remix-run/react";
import { FileText, FolderUp, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

import SplashScreenImage from "~/assets/svgs/splash-screen-image.svg";
import { setPageTitle } from "~/utils/setPageTitle";

import { COURSE_TYPE_SELECTOR_HANDLES } from "../../../../e2e/data/courses/handles";

import Breadcrumb from "./components/Breadcrumb";
import { CourseTypeCard } from "./components/CourseTypeCard";
import { getAddCourseExitPath, withAddCourseContext } from "./utils/addCourseOrigin";

import type { MetaFunction } from "@remix-run/react";
import type { LucideIcon } from "lucide-react";

type CourseTypeOption = {
  id: "standard" | "scorm" | "mentingoPackage";
  href: string;
  icon: LucideIcon;
  testId: string;
};

const COURSE_TYPE_OPTIONS: CourseTypeOption[] = [
  {
    id: "standard",
    href: "/admin/beta-courses/new/standard",
    icon: FileText,
    testId: COURSE_TYPE_SELECTOR_HANDLES.STANDARD_CARD,
  },
  {
    id: "scorm",
    href: "/admin/courses/new-scorm",
    icon: Package,
    testId: COURSE_TYPE_SELECTOR_HANDLES.SCORM_CARD,
  },
  {
    id: "mentingoPackage",
    href: "/admin/courses/import-package",
    icon: FolderUp,
    testId: COURSE_TYPE_SELECTOR_HANDLES.MENTINGO_PACKAGE_CARD,
  },
];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

const CourseTypeSelectorPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const exitPath = getAddCourseExitPath(searchParams);
  const getOptionHref = (option: CourseTypeOption) =>
    option.id === "standard" ? withAddCourseContext(option.href, searchParams) : option.href;

  return (
    <main
      data-testid={COURSE_TYPE_SELECTOR_HANDLES.PAGE}
      className="flex h-screen overflow-auto bg-white px-20 py-8"
    >
      <div className="flex w-full items-center justify-center">
        <img src={SplashScreenImage} alt="" className="rounded" />
      </div>
      <div className="flex w-full max-w-[820px] flex-col justify-center gap-y-6 px-8">
        <Breadcrumb backTo={exitPath} backButtonTestId={COURSE_TYPE_SELECTOR_HANDLES.BACK_BUTTON} />
        <hgroup className="flex flex-col gap-1">
          <h1 className="h3 text-neutral-950">{t("adminCourseTypeSelector.title")}</h1>
          <p className="body-lg-md text-neutral-800">{t("adminCourseTypeSelector.subtitle")}</p>
        </hgroup>
        <ul className="flex flex-col gap-3">
          {COURSE_TYPE_OPTIONS.map((option) => (
            <li key={option.id}>
              <CourseTypeCard
                title={t(`adminCourseTypeSelector.${option.id}.title`)}
                description={t(`adminCourseTypeSelector.${option.id}.description`)}
                href={getOptionHref(option)}
                icon={option.icon}
                accent={option.id}
                testId={option.testId}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

export default CourseTypeSelectorPage;
