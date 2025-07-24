import type { AdminSettings, AllSettings } from "~/modules/Dashboard/Settings/types";

export const isAdminSettings = (settings: AllSettings | undefined): settings is AdminSettings => {
  if (!settings) return false;

  const hasAdminKey = "adminNewUserNotification" in settings;

  return hasAdminKey;
};
