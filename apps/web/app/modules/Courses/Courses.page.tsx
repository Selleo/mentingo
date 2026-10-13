import { Navigate } from "@remix-run/react";
import { ACCESS_GUARD, PERMISSIONS } from "@repo/shared";
import { useLayoutEffect } from "react";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { usePublicGlobalSettingsSuspense } from "~/api/queries/usePublicGlobalSettingsSuspense";
import { useUserSettingsSuspense } from "~/api/queries/useUserSettings";
import { hasPermission } from "~/common/permissions/permission.utils";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import GroupManagerModernCoursesView from "~/modules/Courses/components/modern/GroupManagerModernCoursesView";
import ModernCoursesView from "~/modules/Courses/components/modern/ModernCoursesView";
import LegacyCoursesView from "~/modules/Courses/LegacyCoursesView";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { isSupportedLanguage } from "~/utils/browser-language";
import { getDefaultAuthenticatedRedirect } from "~/utils/getDefaultAuthenticatedRedirect";
import { setPageTitle } from "~/utils/setPageTitle";

import bodyStyles from "./bodyStyles.css?url";

import type { LinksFunction } from "@remix-run/node";
import type { MetaFunction } from "@remix-run/react";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: bodyStyles }];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.courses");

export default function CoursesPage() {
  const { data: globalSettings } = usePublicGlobalSettingsSuspense();
  const { data: currentUser } = useCurrentUserSessionSuspense();

  if (
    currentUser &&
    !hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ) &&
    !hasPermission(currentUser.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  ) {
    return (
      <Navigate
        replace
        to={getDefaultAuthenticatedRedirect(currentUser, globalSettings, {
          exclude: ["/courses"],
        })}
      />
    );
  }

  return currentUser ? <AuthenticatedCourses /> : <CoursesView />;
}

function AuthenticatedCourses() {
  const { data: userSettings } = useUserSettingsSuspense();
  const language = useLanguageStore((state) => state.language);
  const initializeLanguage = useLanguageStore((state) => state.initializeLanguage);
  const requestedLanguage = userSettings?.language;

  useLayoutEffect(() => {
    initializeLanguage(requestedLanguage);
  }, [initializeLanguage, requestedLanguage]);

  if (
    requestedLanguage &&
    isSupportedLanguage(requestedLanguage) &&
    language !== requestedLanguage
  ) {
    return null;
  }

  return <CoursesView />;
}

function CoursesView() {
  const { data: currentUser } = useCurrentUserSessionSuspense();
  const { data: globalSettings } = usePublicGlobalSettingsSuspense();

  const isGroupManager = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
  );

  if (isGroupManager) {
    return <GroupManagerModernCoursesView />;
  }

  const shouldShowModernView = Boolean(globalSettings?.modernCourseListEnabled);

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      {shouldShowModernView ? <ModernCoursesView /> : <LegacyCoursesView />}
    </ContentAccessGuard>
  );
}
