import type { SupportedLanguages } from "@repo/shared";
import type { CompanyInformationSchema } from "src/settings/schemas/settings.schema";

export type ActivityHistory = {
  [date: string]: boolean;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  learningPathsEnabled: boolean;
  enforceSSO: boolean;
  modernCourseListEnabled: boolean;
  calendarEnabled: boolean;
  liveTrainingEnabled: boolean;
  companyInformation?: CompanyInformationSchema;
  platformLogoS3Key: string | null;
  platformSimpleLogoS3Key: string | null;
  primaryColor: string | null;
  contrastColor: string | null;
  loginBackgroundImageS3Key: string | null;
};

export type StudentSettings = {
  language: SupportedLanguages;
  isMFAEnabled: boolean;
  MFASecret: string | null;
};

export type AdminSettings = StudentSettings & { adminNewUserNotification: boolean };
export type UserSettings = StudentSettings | AdminSettings;
export type AllSettings = StudentSettings | AdminSettings | GlobalSettings;
