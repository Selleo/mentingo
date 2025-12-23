import type { ALLOWED_CURRENCIES } from "./constants";
import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  enforceSSO: boolean;
  platformLogoS3Key: string | null;
  MFAEnforcedRoles: GetPublicGlobalSettingsResponse["data"]["MFAEnforcedRoles"];
  certificateBackgroundImage: string | null;
  defaultCourseCurrency: GetPublicGlobalSettingsResponse["data"]["defaultCourseCurrency"];
  inviteOnlyRegistration: boolean;
  loginBackgroundImageS3Key: string | null;
  userEmailTriggers: GetPublicGlobalSettingsResponse["data"]["userEmailTriggers"];
  unregisteredUserQAAccessibility: GetPublicGlobalSettingsResponse["data"]["unregisteredUserQAAccessibility"];
  QAEnabled: GetPublicGlobalSettingsResponse["data"]["QAEnabled"];
  unregisteredUserNewsAccessibility: GetPublicGlobalSettingsResponse["data"]["unregisteredUserNewsAccessibility"];
  newsEnabled: GetPublicGlobalSettingsResponse["data"]["newsEnabled"];
  unregisteredUserArticlesAccessibility: GetPublicGlobalSettingsResponse["data"]["unregisteredUserArticlesAccessibility"];
  articlesEnabled: GetPublicGlobalSettingsResponse["data"]["articlesEnabled"];
};

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
