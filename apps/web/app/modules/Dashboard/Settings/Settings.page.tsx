import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import LanguageSelect from "./components/LanguageSelect";
import ChangePasswordForm from "./forms/ChangePasswordForm";
import NotificationPreferencesForm from "./forms/NotificationPreferencesForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: settings } = useUserSettings();
  console.log("settings", settings);

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <LanguageSelect />
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
      {isAdmin && settings && <NotificationPreferencesForm settings={settings} />}
    </PageWrapper>
  );
}
