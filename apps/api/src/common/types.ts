export type ActivityHistory = {
  [date: string]: boolean;
};

export type UserSettings = {
  language: string;
};

export type AdminSettings = UserSettings & { adminNewUserNotification: boolean };

export type AllSettings = UserSettings | AdminSettings;
