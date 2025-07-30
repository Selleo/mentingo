import AdminPreferences from "./Preferences";

import type { GlobalSettings, UserSettings } from "../../types";

interface OrganizationTabContentProps {
  isAdmin: boolean;
  userSettings: UserSettings;
  globalSettings: GlobalSettings;
}

export default function OrganizationTabContent({
  isAdmin,
  globalSettings,
}: OrganizationTabContentProps) {
  return <>{isAdmin && <AdminPreferences globalSettings={globalSettings} />}</>;
}
