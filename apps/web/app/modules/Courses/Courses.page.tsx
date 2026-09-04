import { redirect } from "@remix-run/react";
import { ACCESS_GUARD, PERMISSIONS } from "@repo/shared";

import { currentUserQueryOptions, useCurrentUser } from "~/api/queries";
import { globalSettingsQueryOptions, useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { userSettingsQueryOptions } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { hasPermission } from "~/common/permissions/permission.utils";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import GroupManagerModernCoursesView from "~/modules/Courses/components/modern/GroupManagerModernCoursesView";
import ModernCoursesView from "~/modules/Courses/components/modern/ModernCoursesView";
import LegacyCoursesView from "~/modules/Courses/LegacyCoursesView";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDefaultAuthenticatedRedirect } from "~/utils/getDefaultAuthenticatedRedirect";
import { setPageTitle } from "~/utils/setPageTitle";

import bodyStyles from "./bodyStyles.css?url";

import type { LinksFunction } from "@remix-run/node";
import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: bodyStyles }];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.courses");

export const clientLoader = async (_args: ClientLoaderFunctionArgs) => {
  const [currentUserResponse, globalSettingsResponse, userSettingsResponse] = await Promise.all([
    queryClient.ensureQueryData(currentUserQueryOptions),
    queryClient.ensureQueryData(globalSettingsQueryOptions),
    queryClient.ensureQueryData(userSettingsQueryOptions),
  ]);

  useLanguageStore.getState().initializeLanguage(userSettingsResponse?.data?.language);

  const currentUser = currentUserResponse?.data;

  if (!currentUser) {
    return null;
  }

  if (
    hasPermission(currentUser.permissions, PERMISSIONS.COURSE_READ) ||
    hasPermission(currentUser.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
  ) {
    return null;
  }

  throw redirect(
    getDefaultAuthenticatedRedirect(currentUser, globalSettingsResponse?.data, {
      exclude: ["/courses"],
    }),
  );
};

export default function CoursesPage() {
  const { data: globalSettings } = useGlobalSettings();
  const { data: currentUser } = useCurrentUser();

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
