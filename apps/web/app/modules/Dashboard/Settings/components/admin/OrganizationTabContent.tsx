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
    </>
  );
}
