import { isAdminSettings } from "~/utils/isAdminSettings";

import ChangePasswordForm from "../forms/ChangePasswordForm";
import UserDetailsForm from "../forms/UserDetailsForm";

import LanguageSelect from "./LanguageSelect";
import NotificationPreferences from "./NotificationPreferences";
import { ResetOnboarding } from "./ResetOnboarding";

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
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
      {isAdmin && isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />}
      {!isAdmin && !isContentCreator && <ResetOnboarding />}
    </>
  );
}
