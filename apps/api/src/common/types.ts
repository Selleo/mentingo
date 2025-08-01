export type ActivityHistory = {
  [date: string]: boolean;
};
export type StudentSettings = {
  language: string;
};

export type AdminSettings = {
  language: string;
  adminNewUserNotification: boolean;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
};

export type UserSettings = StudentSettings | AdminSettings;

export type AllSettings = StudentSettings | AdminSettings | GlobalSettings;
