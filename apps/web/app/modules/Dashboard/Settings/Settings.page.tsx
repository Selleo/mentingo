import { OnboardingPages, PERMISSIONS } from "@repo/shared";
import { Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
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

  const { hasAccess: canManageEnvs } = usePermissions({ required: PERMISSIONS.ENV_MANAGE });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { hasAccess: canManageIntegrationApi } = usePermissions({
    required: PERMISSIONS.INTEGRATION_KEY_MANAGE,
  });
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const { hasAccess: canManageUsers } = usePermissions({ required: PERMISSIONS.USER_MANAGE });
  const { hasAccess: canManageSettings } = usePermissions({
    required: [PERMISSIONS.SETTINGS_MANAGE],
  });

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
