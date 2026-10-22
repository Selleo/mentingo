import { useLoginMethods } from "~/api/queries/useLoginMethods";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { AgeLimitSelect } from "~/modules/Dashboard/Settings/components/admin/AgeLimitSelect";
import { InviteOnlyRegistration } from "~/modules/Dashboard/Settings/components/admin/InviteOnlyRegistration";
import { LiveTrainingMaxParallelSessionsSetting } from "~/modules/Dashboard/Settings/components/admin/LiveTrainingMaxParallelSessionsSetting";
import { UploadFilesToLoginPage } from "~/modules/Dashboard/Settings/components/admin/UploadFilesToLoginPage";

import SSOEnforceSwitch from "../SSOEnforceSwitch";

import { ConfigurationStatus } from "./ConfigurationStatus";
import { DefaultCourseCurrencySelect } from "./DefaultCourseCurrencySelect";
import LoginMethods from "./LoginMethods";
import RoleBasedMFAEnforcementSwitch from "./RoleBasedMFAEnforcementSwitch";

import type { GlobalSettings } from "../../types";

interface OrganizationTabContentProps {
  globalSettings: GlobalSettings;
  canManageEnvs?: boolean;
}

export default function OrganizationTabContent({
  globalSettings,
  canManageEnvs = false,
}: OrganizationTabContentProps) {
  const { data: stripeConfigured } = useStripeConfigured();
  const { data: loginMethods } = useLoginMethods();
  const canEditSSOEnforcement = Boolean(loginMethods?.google || loginMethods?.microsoft);

  return (
    <>
      <ConfigurationStatus />
      {canManageEnvs && <LoginMethods />}
      {canEditSSOEnforcement && <SSOEnforceSwitch enforceSSO={globalSettings.enforceSSO} />}
      <InviteOnlyRegistration inviteOnlyRegistration={globalSettings.inviteOnlyRegistration} />
      <LiveTrainingMaxParallelSessionsSetting
        value={globalSettings.liveTrainingMaxParallelSessions}
      />
      <RoleBasedMFAEnforcementSwitch MFAEnforcedRoles={globalSettings.MFAEnforcedRoles} />
      {stripeConfigured?.enabled && (
        <DefaultCourseCurrencySelect currentCurrency={globalSettings.defaultCourseCurrency} />
      )}
      <AgeLimitSelect limit={globalSettings.ageLimit} />
      <UploadFilesToLoginPage />
    </>
  );
}
