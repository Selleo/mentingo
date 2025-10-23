import { OnboardingPages } from "@repo/shared";
import { Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";

import { useTourSetup } from "../../Onboarding/hooks/useTourSetup";
import { studentSettingsSteps } from "../../Onboarding/routes/student";

import AccountTabContent from "./components/AccountTabContent";
import OrganizationTabContent from "./components/admin/OrganizationTabContent";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";

import type { GlobalSettings } from "./types";

export default function SettingsPage() {
  const { t } = useTranslation();

  const { isContentCreator, isAdmin, isStudent } = useUserRole();
  const { data: userSettings, isLoading: isLoadingUserSettings } = useUserSettings();
  const { data: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();
  const { data: user, isLoading: isLoadingUser } = useCurrentUser();

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
          accountContent={
            <AccountTabContent
              isContentCreator={isContentCreator}
              isAdmin={isAdmin}
              settings={isUserSettings(userSettings) ? userSettings : { language: "en" }}
            />
          }
          organizationContent={
            globalSettings && (
              <OrganizationTabContent
                isAdmin={isAdmin}
                userSettings={isUserSettings(userSettings) ? userSettings : { language: "en" }}
                globalSettings={globalSettings as GlobalSettings}
              />
            )
          }
        />
      </Suspense>
    </PageWrapper>
  );
}
