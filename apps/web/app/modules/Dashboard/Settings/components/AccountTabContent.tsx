import { isAdminSettings } from "~/utils/isAdminSettings";

import ChangePasswordForm from "../forms/ChangePasswordForm";
import UserDetailsForm from "../forms/UserDetailsForm";

import LanguageSelect from "./LanguageSelect";
import NotificationPreferences from "./NotificationPreferences";
import { ResetOnboarding } from "./ResetOnboarding";

import type { AdminSettings, UserSettings } from "../types";

interface AccountTabContentProps {
  canManageCourses: boolean;
  canManageUsers: boolean;
  canResetOnboarding: boolean;
  settings: AdminSettings | UserSettings;
}

export default function AccountTabContent({
  canManageCourses,
  canManageUsers,
  canResetOnboarding,
  settings,
}: AccountTabContentProps) {
  return (
    <>
      <LanguageSelect />
      {(canManageCourses || canManageUsers) && <UserDetailsForm />}
      <ChangePasswordForm />
      {isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />}
      {canResetOnboarding && <ResetOnboarding />}
    </>
  );
}
