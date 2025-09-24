import { isAdminSettings } from "~/utils/isAdminSettings";

import ChangePasswordForm from "../forms/ChangePasswordForm";
import UserDetailsForm from "../forms/UserDetailsForm";
import UserForm from "../forms/UserForm";

import LanguageSelect from "./LanguageSelect";
import NotificationPreferences from "./NotificationPreferences";

import type { AdminSettings, UserSettings } from "../types";

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
      {isAdmin && isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />}
    </>
  );
}
