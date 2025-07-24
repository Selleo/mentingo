export const DEFAULT_USER_SETTINGS = {
  language: "en",
};

export const DEFAULT_USER_ADMIN_SETTINGS = {
  ...DEFAULT_USER_SETTINGS,
  adminNewUserNotification: false,
};

export const DEFAULT_GLOBAL_SETTINGS = {
  platformLogoS3Key: null as string | null,
} as const;

export type GlobalSettingsType = {
  platformLogoS3Key: string | null;
};
