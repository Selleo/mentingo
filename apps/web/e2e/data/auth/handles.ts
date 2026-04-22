export const LOGIN_PAGE_HANDLES = {
  PAGE: "login-page",
  EMAIL: "auth-email-input",
  PASSWORD: "auth-password-input",
  LOGIN: "auth-login-button",
  FORGOT_PASSWORD_LINK: "login-page-forgot-password-link",
  MAGIC_LINK_LINK: "login-page-magic-link-link",
  REGISTER_LINK: "login-page-register-link",
} as const;

export const REGISTER_PAGE_HANDLES = {
  PAGE: "register-page",
  FIRST_NAME: "register-first-name-input",
  LAST_NAME: "register-last-name-input",
  BIRTHDAY: "register-birthday-input",
  EMAIL: "register-email-input",
  PASSWORD: "register-password-input",
  SUBMIT: "register-submit-button",
  SIGN_IN_LINK: "register-sign-in-link",
} as const;

export const CREATE_NEW_PASSWORD_PAGE_HANDLES = {
  PAGE: "create-new-password-page",
  NEW_PASSWORD: "create-new-password-input",
  NEW_PASSWORD_CONFIRMATION: "create-new-password-confirmation-input",
  SUBMIT: "create-new-password-submit-button",
} as const;

export const PASSWORD_RECOVERY_PAGE_HANDLES = {
  PAGE: "password-recovery-page",
  EMAIL: "password-recovery-email-input",
  SUBMIT: "password-recovery-submit-button",
  BACK_TO_LOGIN_LINK: "password-recovery-back-to-login-link",
} as const;

export const MAGIC_LINK_PAGE_HANDLES = {
  PAGE: "magic-link-page",
  EMAIL: "magic-link-email-input",
  SUBMIT: "magic-link-submit-button",
  BACK_TO_LOGIN_LINK: "magic-link-back-to-login-link",
} as const;

export const MFA_PAGE_HANDLES = {
  PAGE: "mfa-page",
  SECRET: "mfa-secret-value",
  TOKEN: "mfa-token-input",
  SUBMIT: "mfa-submit-button",
} as const;
