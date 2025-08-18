import SSOEnforceSwitch from "../SSOEnforceSwitch";

import AdminPreferences from "./Preferences";
import RoleBasedMFAEnforcementSwitch from "./RoleBasedMFAEnforcementSwitch";

import type { GlobalSettings, UserSettings } from "../../types";

const isGoogleOAuthEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true";
const isMicrosoftOAuthEnabled = import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED === "true";

interface OrganizationTabContentProps {
  isAdmin: boolean;
  userSettings: UserSettings;
  globalSettings: GlobalSettings;
}

export default function OrganizationTabContent({
  isAdmin,
  globalSettings,
}: OrganizationTabContentProps) {
  const canEditSSOEnforcement = (isGoogleOAuthEnabled || isMicrosoftOAuthEnabled) && isAdmin;

  return (
    <>
      {isAdmin && <AdminPreferences globalSettings={globalSettings} />}
      {canEditSSOEnforcement && <SSOEnforceSwitch enforceSSO={globalSettings.enforceSSO} />}
      <RoleBasedMFAEnforcementSwitch MFAEnforcedRoles={globalSettings.MFAEnforcedRoles} />
    </>
  );
}
