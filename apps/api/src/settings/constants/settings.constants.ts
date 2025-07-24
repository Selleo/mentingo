import type { AdminSettings, GlobalSettings, StudentSettings } from "src/common/types";

export const DEFAULT_STUDENT_SETTINGS: StudentSettings = {
  language: "en",
};

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  ...DEFAULT_STUDENT_SETTINGS,
  adminNewUserNotification: true,
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  unregisteredUserCoursesAccessibility: false,
};

export const DEFAULT_GLOBAL_SETTINGS = {
  platformLogoS3Key: null,
};
