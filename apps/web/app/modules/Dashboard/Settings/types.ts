import type { ALLOWED_CURRENCIES } from "./constants";
import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

export type GlobalSettings = GetPublicGlobalSettingsResponse["data"];

export type UserSettings = {
  language: string;
};

export type AdminSettings = UserSettings & {
  adminNewUserNotification: boolean;
  adminFinishedCourseNotification: boolean;
  adminOverdueCourseNotification: boolean;
};

export type AllSettings = UserSettings | AdminSettings | GlobalSettings;

export type AllowedCurrency = (typeof ALLOWED_CURRENCIES)[number];
