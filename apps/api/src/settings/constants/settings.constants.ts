const DEFAULT_COMPANY_INFORMATION = {
  companyName: "",
  registeredAddress: "",
  taxNumber: "",
  emailAddress: "",
  courtRegisterNumber: "",
};

export const DEFAULT_GLOBAL_SETTINGS = {
  unregisteredUserCoursesAccessibility: false,
  companyInformation: DEFAULT_COMPANY_INFORMATION,
  enforceSSO: false,
  certificateBackgroundImage: null,
  platformLogoS3Key: null,
  MFAEnforcedRoles: [],
};

export const DEFAULT_STUDENT_SETTINGS = {
  language: "en",
  isMFAEnabled: false,
  MFASecret: null,
};

export const DEFAULT_ADMIN_SETTINGS = {
  ...DEFAULT_STUDENT_SETTINGS,
  adminNewUserNotification: true,
};
