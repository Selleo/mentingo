import { useUserSettings } from "~/api/queries/useAdminSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import { isAdminSettings } from "~/utils/isAdminSettings";

import LanguageSelect from "./components/LanguageSelect";
import ChangePasswordForm from "./forms/ChangePasswordForm";
import NotificationPreferencesForm from "./forms/NotificationPreferencesForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <LanguageSelect />
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
      {isAdmin && userSettings && isAdminSettings(userSettings) && (
        <NotificationPreferencesForm settings={userSettings} />
      )}
    </PageWrapper>
  );
}
