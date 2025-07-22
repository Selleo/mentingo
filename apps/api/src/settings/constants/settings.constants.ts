export const DEFAULT_GLOBAL_SETTINGS = {
  unregisteredUserCoursesAccessibility: true,
};

export const DEFAULT_USER_SETTINGS = {
  language: "en",
};

export const DEFAULT_USER_ADMIN_SETTINGS = {
  ...DEFAULT_USER_SETTINGS,
  adminNewUserNotification: false,
};
