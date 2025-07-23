import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import AdminPreferences from "./components/admin/Preferences";
import LanguageSelect from "./components/LanguageSelect";
import ChangePasswordForm from "./forms/ChangePasswordForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";

import type { AdminSettings } from "~/api/generated-api";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();
  const { data: globalSettings } = useGlobalSettings();

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <LanguageSelect />
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
      {isAdmin && userSettings && globalSettings && (
        <AdminPreferences
          settings={userSettings as AdminSettings}
          globalSettings={globalSettings}
        />
      )}
    </PageWrapper>
  );
}
