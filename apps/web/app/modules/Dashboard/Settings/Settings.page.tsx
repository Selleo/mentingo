import { Loader } from "lucide-react";
import { Suspense } from "react";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import AccountTabContent from "./components/AccountTabContent";
import OrganizationTabContent from "./components/admin/OrganizationTabContent";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";

import type { GlobalSettings } from "./types";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();
  const { data: globalSettings } = useGlobalSettings();

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
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
              settings={userSettings!}
            />
          }
          organizationContent={
            globalSettings && (
              <OrganizationTabContent
                isAdmin={isAdmin}
                userSettings={userSettings!}
                globalSettings={globalSettings as GlobalSettings}
              />
            )
          }
        />
      </Suspense>
    </PageWrapper>
  );
}
