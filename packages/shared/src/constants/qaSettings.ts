export const ALLOWED_QA_SETTINGS = {
  QA_ENABLED: "QAEnabled",
  UNREGISTERED_USER_QA_ACCESSIBILITY: "unregisteredUserQAAccessibility",
} as const;

export type AllowedQASettings = (typeof ALLOWED_QA_SETTINGS)[keyof typeof ALLOWED_QA_SETTINGS];
