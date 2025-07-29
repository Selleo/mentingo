import type { AdminSettings, GlobalSettings, StudentSettings } from "src/common/types";

export const DEFAULT_USER_SETTINGS: StudentSettings = {
  language: "en",
};

export const DEFAULT_USER_ADMIN_SETTINGS: AdminSettings = {
  language: "en",
  adminNewUserNotification: true,
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  unregisteredUserCoursesAccessibility: false,
};
