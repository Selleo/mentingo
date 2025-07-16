export type ActivityHistory = {
  [date: string]: boolean;
};

export type UserSettings = {
  adminNewUserNotification?: boolean;
  language?: string;
  [key: string]: any;
};
