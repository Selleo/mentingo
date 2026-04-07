import { OnboardingPages, PERMISSIONS } from "@repo/shared";
import { Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { hasAnyPermission, hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { usePermissions } from "~/hooks/usePermissions";
import Loader from "~/modules/common/Loader/Loader";
import CustomizePlatformTabContent from "~/modules/Dashboard/Settings/components/admin/CustomizePlatformTabContent";
import { setPageTitle } from "~/utils/setPageTitle";

import { useTourSetup } from "../../Onboarding/hooks/useTourSetup";
import { studentSettingsSteps } from "../../Onboarding/routes/student";

import AccountTabContent from "./components/AccountTabContent";
import OrganizationTabContent from "./components/admin/OrganizationTabContent";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.settings");

export default function SettingsPage() {
  const { t } = useTranslation();

  const { permissions } = usePermissions();

  const {
    canManageEnvs,
    canManageCourses,
    canManageIntegrationApi,
    canUpdateLearningProgress,
    canManageUsers,
    canManageSettings,
  } = useMemo(() => {
    return {
      canManageEnvs: hasPermission(permissions, PERMISSIONS.ENV_MANAGE),
      canManageCourses: hasAnyPermission(permissions, [
        PERMISSIONS.COURSE_UPDATE,
        PERMISSIONS.COURSE_UPDATE_OWN,
      ]),
      canManageIntegrationApi: hasPermission(permissions, PERMISSIONS.INTEGRATION_KEY_MANAGE),
      canUpdateLearningProgress: hasPermission(permissions, PERMISSIONS.LEARNING_PROGRESS_UPDATE),
      canManageUsers: hasPermission(permissions, PERMISSIONS.USER_MANAGE),
      canManageSettings: hasPermission(permissions, PERMISSIONS.SETTINGS_MANAGE),
    };
  }, [permissions]);

  const { data: user, isLoading: isLoadingUser } = useCurrentUser();
  const isSupportMode = Boolean(user?.isSupportMode);
  const { data: userSettings, isLoading: isLoadingUserSettings } = useUserSettings(!isSupportMode);
  const { data: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();
  const { data: configurationState } = useConfigurationState({
    enabled: canManageEnvs,
  });

  const isLoading =
    (isSupportMode ? false : isLoadingUserSettings) || isLoadingGlobalSettings || isLoadingUser;

  const steps = useMemo(
    () => (canUpdateLearningProgress ? studentSettingsSteps(t) : []),
    [canUpdateLearningProgress, t],
  );

  useTourSetup({
    steps,
    hasCompletedTour: user?.onboardingStatus.settings,
    isLoading,
    page: OnboardingPages.SETTINGS,
  });

  const isUserSettings = (
    settings: typeof userSettings,
  ): settings is { language: string } & typeof userSettings => {
    return settings != null && "language" in settings;
  };

  const hasConfigurationIssues =
    canManageEnvs && configurationState?.hasIssues && !configurationState?.isWarningDismissed;

  return (
    <PageWrapper
      className="flex flex-col *:h-min"
      breadcrumbs={[{ title: t("settings.breadcrumbs.settings"), href: "/settings" }]}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        }
      >
        <SettingsNavigationTabs
          canManageSettings={canManageSettings}
          hideAccountTab={isSupportMode}
          hasConfigurationIssues={hasConfigurationIssues}
          accountContent={
            !isSupportMode && (
              <AccountTabContent
                canManageCourses={canManageCourses}
                canAccessIntegrationApi={canManageIntegrationApi}
                canResetOnboarding={canUpdateLearningProgress}
                canManageUsers={canManageUsers}
                settings={isUserSettings(userSettings) ? userSettings : { language: "en" }}
              />
            )
          }
          organizationContent={
            globalSettings && <OrganizationTabContent globalSettings={globalSettings} />
          }
          customizePlatformContent={
            globalSettings && (
              <CustomizePlatformTabContent
                canManageUsers={canManageUsers}
                globalSettings={globalSettings}
              />
            )
          }
        />
      </Suspense>
    </PageWrapper>
  );
}
