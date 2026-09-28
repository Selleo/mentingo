import { useIsPhoneAuthEnabled } from "~/api/queries/usePhoneAuthConfig";
import { isAdminSettings } from "~/utils/isAdminSettings";

import ChangePasswordForm from "../forms/ChangePasswordForm";
import PhoneNumberForm from "../forms/PhoneNumberForm";
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
  const isPhoneAuthEnabled = useIsPhoneAuthEnabled();

  return (
    <>
      <LanguageSelect />
      {(canManageCourses || canManageUsers) && <UserDetailsForm />}
      {isPhoneAuthEnabled && <PhoneNumberForm />}
      <ChangePasswordForm />
      {isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />}
      {canResetOnboarding && <ResetOnboarding />}
    </>
  );
}
