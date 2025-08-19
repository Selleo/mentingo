import { hasKeys } from "./hasKeys";

import type { AdminSettings, AllSettings } from "~/modules/Dashboard/Settings/types";

export const isAdminSettings = (settings: AllSettings): settings is AdminSettings => {
  return hasKeys<AdminSettings>(settings, [
    "adminNewUserNotification",
    "adminFinishedCourseNotification",
  ]);
};
