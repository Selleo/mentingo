import type { CompanyInformationSchema } from "src/settings/schemas/settings.schema";

export type ActivityHistory = {
  [date: string]: boolean;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  enforceSSO: boolean;
  companyInformation?: CompanyInformationSchema;
  platformLogoS3Key: string | null;
};

export type StudentSettings = {
  language: string;
};

export type AdminSettings = StudentSettings & { adminNewUserNotification: boolean };
export type UserSettings = StudentSettings | AdminSettings;
export type AllSettings = StudentSettings | AdminSettings | GlobalSettings;
