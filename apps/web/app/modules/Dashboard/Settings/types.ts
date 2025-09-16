import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  enforceSSO: boolean;
  platformLogoS3Key: string | null;
  MFAEnforcedRoles: GetPublicGlobalSettingsResponse["data"]["MFAEnforcedRoles"];
  certificateBackgroundImage: string | null;
};

export type UserSettings = {
  language: string;
};

export type AdminSettings = UserSettings & {
  adminNewUserNotification: boolean;
  adminFinishedCourseNotification: boolean;
};

export type AllSettings = UserSettings | AdminSettings | GlobalSettings;
