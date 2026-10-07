import {
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_RUN_STATUSES,
  type AutomationEmailDeliveryStatus,
  type AutomationRunStatus,
} from "@repo/shared";

export const AUTOMATION_EMAIL_DELIVERY_REASON_CODES = {
  AUTOMATION_CHANGED: "automation_changed",
  STEP_UNAVAILABLE: "step_unavailable",
  ATTEMPTS_EXHAUSTED: "attempts_exhausted",
  TEMPLATE_CHANGED: "template_changed",
  BUILTIN_TEMPLATE_CHANGED: "builtin_template_changed",
  TEMPLATE_REPUBLISHED: "template_republished",
  ACCOUNT_ACTION_EXPIRED_OR_REVOKED: "account_action_expired_or_revoked",
  EMAIL_ACTION_FAILED: "email_action_failed",
  LIVE_DEFINITION_CHANGED: "live_definition_changed",
  INTERRUPTED_DELIVERY: "interrupted_delivery",
} as const;

export const ACTIVE_AUTOMATION_EMAIL_DELIVERY_STATUSES: AutomationEmailDeliveryStatus[] = [
  AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING,
  AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING,
  AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING,
];

export const CLAIMABLE_AUTOMATION_EMAIL_DELIVERY_STATUSES: AutomationEmailDeliveryStatus[] = [
  AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING,
  AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING,
];

export const ACTIVE_AUTOMATION_RUN_STATUSES: AutomationRunStatus[] = [
  AUTOMATION_RUN_STATUSES.PENDING,
  AUTOMATION_RUN_STATUSES.PROCESSING,
];

export const AUTOMATION_EMAIL_DELIVERY_JOB_NAME = "send-email";
export const AUTOMATION_RETRY_DELAY_MS = 1000;

export const AUTOMATION_EMAIL_DELIVERY_DIRECTIONS = {
  PREVIOUS: "previous",
  NEXT: "next",
} as const;

export const AUTOMATION_INTERRUPTED_DELIVERY_TIMEOUT_MS = 5 * 60 * 1000;

export const NOTIFICATION_ACCOUNT_ACTION_KINDS = {
  CREATE_PASSWORD: "create_password",
  RESET_PASSWORD: "reset_password",
  SIGN_IN: "sign_in",
} as const;

export const NOTIFICATION_ACCOUNT_ACTION_INTENT_RETENTION_DAYS = 7;

/** Increment when deployment changes built-in definitions or publications.
 * Workers must be deployed together; queued deliveries retain this template version.
 */
export const BUILT_IN_TEMPLATE_VERSION = 2;

export const NOTIFICATION_ACCOUNT_ACTION_PREPARATION = Symbol(
  "NOTIFICATION_ACCOUNT_ACTION_PREPARATION",
);
