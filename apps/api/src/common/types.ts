export type ActivityHistory = {
  [date: string]: boolean;
};

export type CompanyInformation = {
  companyName?: string;
  registeredAddress?: string;
  taxNumber?: string;
  emailAddress?: string;
  courtRegisterNumber?: string;
};

export type GlobalSettings = {
  unregisteredUserCoursesAccessibility: boolean;
  companyInformation?: CompanyInformation;
};

export type StudentSettings = {
  language: string;
};

export type AdminSettings = StudentSettings & { adminNewUserNotification: boolean };
export type UserSettings = StudentSettings | AdminSettings;
export type AllSettings = StudentSettings | AdminSettings | GlobalSettings;
