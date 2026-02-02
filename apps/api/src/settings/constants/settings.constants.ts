const DEFAULT_COMPANY_INFORMATION = {
  companyName: "",
  companyShortName: "",
  registeredAddress: "",
  taxNumber: "",
  emailAddress: "",
  courtRegisterNumber: "",
};

export const DEFAULT_EMAIL_TRIGGERS = {
  userFirstLogin: false,
  userCourseAssignment: false,
  userShortInactivity: false,
  userLongInactivity: false,
  userChapterFinished: false,
  userCourseFinished: false,
};

export const DEFAULT_GLOBAL_SETTINGS = {
  unregisteredUserQAAccessibility: false,
  QAEnabled: false,
  unregisteredUserNewsAccessibility: false,
  newsEnabled: false,
  unregisteredUserArticlesAccessibility: false,
  articlesEnabled: false,
  unregisteredUserCoursesAccessibility: false,
  modernCourseListEnabled: true,
  companyInformation: DEFAULT_COMPANY_INFORMATION,
  enforceSSO: false,
  certificateBackgroundImage: null,
  platformLogoS3Key: null,
  loginBackgroundImageS3Key: null,
  platformSimpleLogoS3Key: null,
  MFAEnforcedRoles: [],
  defaultCourseCurrency: "pln",
  inviteOnlyRegistration: false,
  userEmailTriggers: DEFAULT_EMAIL_TRIGGERS,
  primaryColor: null,
  contrastColor: null,
  loginPageFiles: [],
};

export const DEFAULT_STUDENT_SETTINGS = {
  language: "en",
  isMFAEnabled: false,
  MFASecret: null,
};

export const DEFAULT_ADMIN_SETTINGS = {
  ...DEFAULT_STUDENT_SETTINGS,
  adminNewUserNotification: true,
  adminFinishedCourseNotification: false,
  adminOverdueCourseNotification: false,
  configWarningDismissed: false,
};

export const ALLOWED_CURRENCIES = ["pln", "eur", "gbp", "usd"] as const;
