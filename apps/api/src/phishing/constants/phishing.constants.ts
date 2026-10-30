export const PHISHING_ENV_KEYS = {
  API_KEY: "PHISHING_API_KEY",
  BASE_URL: "PHISHING_BASE_URL",
  WEBHOOK_SECRET: "PHISHING_WEBHOOK_SECRET",
} as const;

export type PhishingEnvKey = (typeof PHISHING_ENV_KEYS)[keyof typeof PHISHING_ENV_KEYS];

export const PHISHING_WEBHOOK_SECRET_MIN_LENGTH = 32;

export const PHISHING_WEBHOOK_HEADERS = {
  TIMESTAMP: "x-phishing-timestamp",
  SIGNATURE: "x-phishing-signature",
} as const;

export const PHISHING_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export const PHISHING_WEBHOOK_MAX_BODY_BYTES = {
  RISKY_ACTION: 2048,
  CONNECTION_PROBE: 2048,
  EMAIL: 4096,
} as const;

export const PHISHING_RISKY_ACTIONS = { CLICKED: "clicked", SUBMITTED: "submitted" } as const;

export const PHISHING_CAMPAIGN_STATUSES = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const PHISHING_CAMPAIGN_LIMITS = {
  MAX_USERS: 10000,
  MAX_GROUPS: 1000,
  MAX_RECIPIENTS: 10000,
  MAX_SEND_WINDOW_MS: 30 * 24 * 60 * 60 * 1000,
  PAST_SEND_WINDOW_TOLERANCE_MS: 60 * 1000,
} as const;

export const PHISHING_OPTION_KINDS = {
  USERS: "users",
  GROUPS: "groups",
  COURSES: "courses",
} as const;

export const PHISHING_OPTION_PAGE_SIZE = 20;

export const PHISHING_REPORT_FILTERS = { ALL: "all", AT_RISK: "atRisk" } as const;

export const PHISHING_REPORT_SORT_FIELDS = ["name", "sentAt", "clickedAt", "submittedAt"] as const;

export const PHISHING_REPORT_MAX_PER_PAGE = 100;
