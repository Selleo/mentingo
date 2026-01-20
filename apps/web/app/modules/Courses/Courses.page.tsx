import { ACCESS_GUARD } from "@repo/shared";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useUserRole } from "~/hooks/useUserRole";
import ModernCoursesView from "~/modules/Courses/components/modern/ModernCoursesView";
import LegacyCoursesView from "~/modules/Courses/LegacyCoursesView";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.courses");

export default function CoursesPage() {
  const { isStudent } = useUserRole();
  const { data: globalSettings } = useGlobalSettings();

  const shouldShowModernView = isStudent && Boolean(globalSettings?.modernCourseListEnabled);

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      {shouldShowModernView ? <ModernCoursesView /> : <LegacyCoursesView />}
    </ContentAccessGuard>
  );
}
