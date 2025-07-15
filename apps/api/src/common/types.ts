export type ActivityHistory = {
  [date: string]: boolean;
};

export type UserSettings = {
  admin_new_user_notification?: boolean;
  language?: string;
  [key: string]: any;
};
