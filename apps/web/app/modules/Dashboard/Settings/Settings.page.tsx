import { useGetGlobalSettingsSuspense } from "~/api/queries/useGetGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import { isAdminSettings } from "~/utils/isAdminSettings";

import { SSOEnforceSwitch } from "./components";
import LanguageSelect from "./components/LanguageSelect";
import ChangePasswordForm from "./forms/ChangePasswordForm";
import NotificationPreferencesForm from "./forms/NotificationPreferencesForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";

const isGoogleOAuthEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true";
const isMicrosoftOAuthEnabled = import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED === "true";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();
  const { data: globalSettings } = useGetGlobalSettingsSuspense();

  const canEditSSOEnforcement = (isGoogleOAuthEnabled || isMicrosoftOAuthEnabled) && isAdmin;

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <LanguageSelect />
      {canEditSSOEnforcement && <SSOEnforceSwitch enforceSSO={globalSettings?.enforceSSO} />}
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
      {isAdmin && userSettings && isAdminSettings(userSettings) && (
        <NotificationPreferencesForm settings={userSettings} />
      )}
    </PageWrapper>
  );
}
