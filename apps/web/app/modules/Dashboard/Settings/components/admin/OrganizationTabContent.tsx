import AdminPreferences from "./Preferences";

import type { GlobalSettings, UserSettings } from "~/api/generated-api";

interface OrganizationTabContentProps {
  isAdmin: boolean;
  userSettings: UserSettings;
  globalSettings: GlobalSettings;
}

export default function OrganizationTabContent({
  isAdmin,
  userSettings,
  globalSettings,
}: OrganizationTabContentProps) {
  return (
    <>
      {isAdmin && userSettings && globalSettings && (
        <AdminPreferences globalSettings={globalSettings} />
      )}
      {!isAdmin && (
        <div className="py-8 text-center text-muted-foreground">
          You do not have permission to view organization settings.
        </div>
      )}
    </>
  );
}
