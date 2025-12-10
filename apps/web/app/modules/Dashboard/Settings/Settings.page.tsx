import { OnboardingPages } from "@repo/shared";
import { Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { USER_ROLE } from "~/config/userRoles";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";
import CustomizePlatformTabContent from "~/modules/Dashboard/Settings/components/admin/CustomizePlatformTabContent";
import { setPageTitle } from "~/utils/setPageTitle";

import { useTourSetup } from "../../Onboarding/hooks/useTourSetup";
import { studentSettingsSteps } from "../../Onboarding/routes/student";

import AccountTabContent from "./components/AccountTabContent";
import OrganizationTabContent from "./components/admin/OrganizationTabContent";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";

import type { GlobalSettings } from "./types";
import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.settings");

export default function SettingsPage() {
  const { t } = useTranslation();

  const { isContentCreator, isAdmin, isStudent } = useUserRole();
  const { data: userSettings, isLoading: isLoadingUserSettings } = useUserSettings();
  const { data: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();
  const { data: user, isLoading: isLoadingUser } = useCurrentUser();
  const { data: configurationState } = useConfigurationState({
    enabled: user?.role === USER_ROLE.admin,
  });

  const isLoading = isLoadingUserSettings || isLoadingGlobalSettings || isLoadingUser;

  const steps = useMemo(() => (isStudent ? studentSettingsSteps(t) : []), [isStudent, t]);

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
    user?.role === USER_ROLE.admin &&
    configurationState?.hasIssues &&
    !configurationState?.isWarningDismissed;

  return (
    <PageWrapper
      className="flex flex-col *:h-min"
      breadcrumbs={[
        { title: t("settings.breadcrumbs.dashboard"), href: "/" },
        { title: t("settings.breadcrumbs.settings"), href: "/settings" },
      ]}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        }
      >
        <SettingsNavigationTabs
          isAdmin={isAdmin}
          hasConfigurationIssues={hasConfigurationIssues}
          accountContent={
            <AccountTabContent
              isContentCreator={isContentCreator}
              isAdmin={isAdmin}
              settings={isUserSettings(userSettings) ? userSettings : { language: "en" }}
            />
          }
          organizationContent={
            globalSettings && (
              <OrganizationTabContent isAdmin={isAdmin} globalSettings={globalSettings} />
            )
          }
          customizePlatformContent={
            globalSettings && (
              <CustomizePlatformTabContent isAdmin={isAdmin} globalSettings={globalSettings} />
            )
          }
        />
      </Suspense>
    </PageWrapper>
  );
}
