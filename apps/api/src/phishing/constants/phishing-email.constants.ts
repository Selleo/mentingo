import { BUILT_IN_EMAIL_TEMPLATE_KEYS } from "@repo/shared";

export const PHISHING_EMAIL_TEMPLATES = {
  "course-reminder": BUILT_IN_EMAIL_TEMPLATE_KEYS.ASSIGNMENT_WITHOUT_DEADLINE,
  "account-check": BUILT_IN_EMAIL_TEMPLATE_KEYS.MAGIC_LINK,
  "password-reset": BUILT_IN_EMAIL_TEMPLATE_KEYS.PASSWORD_RECOVERY,
  "course-reminder-pair": BUILT_IN_EMAIL_TEMPLATE_KEYS.ASSIGNMENT_WITHOUT_DEADLINE,
  "account-check-pair": BUILT_IN_EMAIL_TEMPLATE_KEYS.MAGIC_LINK,
  "password-reset-pair": BUILT_IN_EMAIL_TEMPLATE_KEYS.PASSWORD_RECOVERY,
} as const;

export type PhishingEmailScenarioId = keyof typeof PHISHING_EMAIL_TEMPLATES;

export const PHISHING_EMAIL_INLINE_IMAGES = {
  LOGO: "logo",
  BORDER_CIRCLE: "border-circle",
} as const;

export const PHISHING_EMAIL_LOCAL_DEVELOPMENT_HOSTS = ["localhost", "127.0.0.1", "[::1]"] as const;
