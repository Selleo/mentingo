// TODO: ask bout this

export const SETTINGS_TYPE = {
  NEW_USER_EMAIL_NOTIFICATION: "new_user_email_notification",
} as const;

export type SettingsType = (typeof SETTINGS_TYPE)[keyof typeof SETTINGS_TYPE];
