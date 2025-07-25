import ChangePasswordForm from "../forms/ChangePasswordForm";
import UserDetailsForm from "../forms/UserDetailsForm";
import UserForm from "../forms/UserForm";

import LanguageSelect from "./LanguageSelect";
import NotificationPreferences from "./NotificationPreferences";

import type { AdminSettings, UserSettings } from "~/api/generated-api";

interface AccountTabContentProps {
  isContentCreator: boolean;
  isAdmin: boolean;
  settings: AdminSettings | UserSettings;
}

export default function AccountTabContent({
  isContentCreator,
  isAdmin,
  settings,
}: AccountTabContentProps) {
  return (
    <>
      <LanguageSelect />
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
      {/* ## TODO: Handle type error */}
      {/* {isAdmin && isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />} */}
      {/* {isAdmin && <NotificationPreferences adminSettings={settings} />} */}
      {/* {isAdmin && isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />} */}
      {isAdmin && <NotificationPreferences adminSettings={settings as AdminSettings} />}
    </>
  );
}
