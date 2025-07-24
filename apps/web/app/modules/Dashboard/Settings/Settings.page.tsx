import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import LanguageSelect from "./components/LanguageSelect";
import { SettingsNavigationTabs } from "./components/SettingsNavigationTabs";
import ChangePasswordForm from "./forms/ChangePasswordForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";
import AdminPreferences from "./components/admin/Preferences";
import { AdminSettings } from "./types";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();
  const { data: userSettings } = useUserSettings();
  const { data: globalSettings } = useGlobalSettings();

  const handleCancel = () => {};

  const handleSave = () => {};

  const accountContent = (
    <>
      <LanguageSelect />
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
    </>
  );

  const organizationContent = (
    <>
      {isAdmin && userSettings && globalSettings && (
        <AdminPreferences
          settings={userSettings as AdminSettings}
          globalSettings={globalSettings}
        />
      )}
      {!isAdmin && (
        <div className="py-8 text-center text-muted-foreground">
          You do not have permission to view organization settings.
        </div>
      )}
    </>
  );

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <SettingsNavigationTabs
        onCancel={handleCancel}
        onSave={handleSave}
        accountContent={accountContent}
        organizationContent={organizationContent}
      />
    </PageWrapper>
  );
}
