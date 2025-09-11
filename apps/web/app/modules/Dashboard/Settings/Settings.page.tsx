import { Loader } from "lucide-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import AccountTabContent from "./components/AccountTabContent";
import OrganizationTabContent from "./components/admin/OrganizationTabContent";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";

import type { GlobalSettings } from "./types";

export default function SettingsPage() {
  const { t } = useTranslation();

  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();
  const { data: globalSettings } = useGlobalSettings();

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
