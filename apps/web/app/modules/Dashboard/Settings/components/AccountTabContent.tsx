import { isAdminSettings } from "~/utils/isAdminSettings";

import ChangePasswordForm from "../forms/ChangePasswordForm";
import UserDetailsForm from "../forms/UserDetailsForm";

import { DiscussionNotificationPreferences } from "./DiscussionNotificationPreferences";
import LanguageSelect from "./LanguageSelect";
import NotificationPreferences from "./NotificationPreferences";
import { ResetOnboarding } from "./ResetOnboarding";

import type { AdminSettings, UserSettings } from "../types";

interface AccountTabContentProps {
  canManageCourses: boolean;
  canManageUsers: boolean;
  canResetOnboarding: boolean;
  hasDiscussions: boolean;
  settings: AdminSettings | UserSettings;
}

export default function AccountTabContent({
  canManageCourses,
  canManageUsers,
  canResetOnboarding,
  hasDiscussions,
  settings,
}: AccountTabContentProps) {
  return (
    <>
      <LanguageSelect />
      {(canManageCourses || canManageUsers) && <UserDetailsForm />}
      <ChangePasswordForm />
      {hasDiscussions && <DiscussionNotificationPreferences settings={settings} />}
      {isAdminSettings(settings) && <NotificationPreferences adminSettings={settings} />}
      {canResetOnboarding && <ResetOnboarding />}
    </>
  );
}
