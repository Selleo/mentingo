export type ActivityHistory = {
  [date: string]: boolean;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
};

export type UserSettings = {
  language: string;
};

export type AdminSettings = UserSettings & { adminNewUserNotification: boolean };

export type AllSettings = UserSettings | AdminSettings;
