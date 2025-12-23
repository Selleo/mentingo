import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { InviteOnlyRegistration } from "~/modules/Dashboard/Settings/components/admin/InviteOnlyRegistration";
import UserEmailTriggers from "~/modules/Dashboard/Settings/components/admin/UserEmailTriggers";

import SSOEnforceSwitch from "../SSOEnforceSwitch";

import { ConfigurationStatus } from "./ConfigurationStatus";
import { DefaultCourseCurrencySelect } from "./DefaultCourseCurrencySelect";
import RoleBasedMFAEnforcementSwitch from "./RoleBasedMFAEnforcementSwitch";

import type { GlobalSettings } from "../../types";

const isGoogleOAuthEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true";
const isMicrosoftOAuthEnabled = import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED === "true";

interface OrganizationTabContentProps {
  isAdmin: boolean;
  globalSettings: GlobalSettings;
}

export default function OrganizationTabContent({
  isAdmin,
  globalSettings,
}: OrganizationTabContentProps) {
  const { data: stripeConfigured } = useStripeConfigured();
  const canEditSSOEnforcement = (isGoogleOAuthEnabled || isMicrosoftOAuthEnabled) && isAdmin;

  return (
    <>
      <ConfigurationStatus />
      {canEditSSOEnforcement && <SSOEnforceSwitch enforceSSO={globalSettings.enforceSSO} />}
      <UserEmailTriggers userEmailTriggers={globalSettings.userEmailTriggers} />
      <InviteOnlyRegistration inviteOnlyRegistration={globalSettings.inviteOnlyRegistration} />
      <RoleBasedMFAEnforcementSwitch MFAEnforcedRoles={globalSettings.MFAEnforcedRoles} />
      {stripeConfigured?.enabled && (
        <DefaultCourseCurrencySelect currentCurrency={globalSettings.defaultCourseCurrency} />
      )}
    </>
  );
}
