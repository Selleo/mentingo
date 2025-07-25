import { Loader } from "lucide-react";
import { Suspense } from "react";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import AccountTabContent from "./components/AccountTabContent";
import OrganizationTabContent from "./components/admin/OrganizationTabContent";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();
  const { data: globalSettings } = useGlobalSettings();

  const handleCancel = () => {
    console.log("Settings cancelled");
  };

  const handleSave = () => {
    console.log("Settings saved");
  };

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        }
      >
        {!userSettings || !globalSettings ? (
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        ) : (
          <SettingsNavigationTabs
            isAdmin={isAdmin}
            onCancel={handleCancel}
            onSave={handleSave}
            accountContent={
              <AccountTabContent
                isContentCreator={isContentCreator}
                isAdmin={isAdmin}
                settings={userSettings}
              />
            }
            organizationContent={
              <OrganizationTabContent
                isAdmin={isAdmin}
                userSettings={userSettings}
                globalSettings={globalSettings}
              />
            }
          />
        )}
      </Suspense>
    </PageWrapper>
  );
}
