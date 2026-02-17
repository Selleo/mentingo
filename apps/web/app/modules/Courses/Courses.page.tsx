import { ACCESS_GUARD } from "@repo/shared";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import ModernCoursesView from "~/modules/Courses/components/modern/ModernCoursesView";
import LegacyCoursesView from "~/modules/Courses/LegacyCoursesView";
import { setPageTitle } from "~/utils/setPageTitle";

import bodyStyles from "./bodyStyles.css?url";

import type { LinksFunction } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/react";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: bodyStyles }];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.courses");

export default function CoursesPage() {
  const { data: globalSettings } = useGlobalSettings();

  const shouldShowModernView = Boolean(globalSettings?.modernCourseListEnabled);

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      {shouldShowModernView ? <ModernCoursesView /> : <LegacyCoursesView />}
    </ContentAccessGuard>
  );
}
