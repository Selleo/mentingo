import type { SUPPORTED_LOCALES } from "./constants";
import type { CompanyInformationSchema } from "src/settings/schemas/settings.schema";

export type ActivityHistory = {
  [date: string]: boolean;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  enforceSSO: boolean;
  companyInformation?: CompanyInformationSchema;
  platformLogoS3Key: string | null;
  primaryColor: string | null;
  loginBackgroundImageS3Key: string | null;
};

export type StudentSettings = {
  language: string;
  isMFAEnabled: boolean;
  MFASecret: string | null;
};

export type AdminSettings = StudentSettings & { adminNewUserNotification: boolean };
export type UserSettings = StudentSettings | AdminSettings;
export type AllSettings = StudentSettings | AdminSettings | GlobalSettings;

export type SupportedLocales = (typeof SUPPORTED_LOCALES)[number];
