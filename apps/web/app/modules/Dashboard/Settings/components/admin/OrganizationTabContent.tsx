import { InviteOnlyRegistration } from "~/modules/Dashboard/Settings/components/admin/InviteOnlyRegistration";
import UserEmailTriggers from "~/modules/Dashboard/Settings/components/admin/UserEmailTriggers";

import { PlatformLogoForm } from "../../forms/PlatformLogoForm";
import { PlatformSimpleLogoForm } from "../../forms/PlatformSimpleLogoForm";
import SSOEnforceSwitch from "../SSOEnforceSwitch";

import { CertificateBackgroundUpload } from "./CertificateBackgroundUpload";
import { DefaultCourseCurrencySelect } from "./DefaultCourseCurrencySelect";
import { OrganizationLoginBackgroundUpload } from "./OrganizationLoginBackgroundUpload";
import { OrganizationTheme } from "./OrganizationTheme";
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
      <AdminPreferences globalSettings={globalSettings} />
      {canEditSSOEnforcement && <SSOEnforceSwitch enforceSSO={globalSettings.enforceSSO} />}
      <UserEmailTriggers userEmailTriggers={globalSettings.userEmailTriggers} />
      <InviteOnlyRegistration inviteOnlyRegistration={globalSettings.inviteOnlyRegistration} />
      <RoleBasedMFAEnforcementSwitch MFAEnforcedRoles={globalSettings.MFAEnforcedRoles} />
      <DefaultCourseCurrencySelect currentCurrency={globalSettings.defaultCourseCurrency} />
      <CertificateBackgroundUpload
        certificateBackgroundImage={globalSettings.certificateBackgroundImage}
      />
      <OrganizationLoginBackgroundUpload
        backgroundImage={globalSettings.loginBackgroundImageS3Key}
      />
      <PlatformLogoForm />
      <PlatformSimpleLogoForm />
      <OrganizationTheme />
    </>
  );
}
