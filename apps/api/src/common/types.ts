export type ActivityHistory = {
  [date: string]: boolean;
};
export type StudentSettings = {
  language: string;
  isMFAEnabled: boolean;
  MFASecret: string | null;
};

export type AdminSettings = {
  language: string;
  adminNewUserNotification: boolean;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  platformLogoS3Key: string | null;
};

export type UserSettings = StudentSettings | AdminSettings;

export type AllSettings = StudentSettings | AdminSettings | GlobalSettings;
