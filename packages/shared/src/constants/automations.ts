export const AUTOMATION_STATUSES = {
  DRAFT: "draft",
  ENABLED: "enabled",
  DISABLED: "disabled",
  ARCHIVED: "archived",
} as const;

export const AUTOMATION_STEP_TYPES = {
  TRIGGER: "trigger",
  SEND_EMAIL: "send_email",
  CONDITION: "condition",
} as const;
export const AUTOMATION_MAPPING_TYPES = { EVENT_FIELD: "event_field", STATIC: "static" } as const;

/** Notification occurrences are independent of the templates selected by an automation. */
export const AUTOMATION_EVENT_KINDS = {
  WELCOME: "welcome",
  PASSWORD_RECOVERY: "password_recovery",
  PASSWORD_REMINDER: "password_reminder",
  USER_INVITE: "user_invite",
  USER_FIRST_LOGIN: "user_first_login",
  USER_ASSIGNED_TO_COURSE: "user_assigned_to_course",
  USER_SHORT_INACTIVITY: "user_short_inactivity",
  USER_LONG_INACTIVITY: "user_long_inactivity",
  USER_FINISHED_CHAPTER: "user_finished_chapter",
  USER_FINISHED_COURSE: "user_finished_course",
  CERTIFICATE_EXPIRATION_WARNING: "certificate_expiration_warning",
  CERTIFICATE_EXPIRED: "certificate_expired",
  ADMIN_NEW_USER: "admin_new_user",
  ADMIN_FINISHED_COURSE: "admin_finished_course",
  ADMIN_OVERDUE_COURSES: "admin_overdue_courses",
  COURSE_DUE_DATE_REMINDER: "course_due_date_reminder",
  MAGIC_LINK: "magic_link",
  COURSE_CHAT_MENTION: "course_chat_mention",
  ANNOUNCEMENT: "announcement",
  LIVE_TRAINING_STARTED: "live_training_started",
  LIVE_TRAINING_REMINDER: "live_training_reminder",
  LIVE_TRAINING_ENDED: "live_training_ended",
} as const;

/** Stable resource keys, deliberately separate from the notification catalog. */
export const BUILT_IN_EMAIL_TEMPLATE_KEYS = {
  ASSIGNMENT_WITH_DEADLINE: "assignment_with_deadline",
  ASSIGNMENT_WITHOUT_DEADLINE: "assignment_without_deadline",
  COMPLETION_WITH_CERTIFICATE: "completion_with_certificate",
  COMPLETION_WITHOUT_CERTIFICATE: "completion_without_certificate",
  CERTIFICATE_MANUALLY_RESET: "certificate_manually_reset",
  CERTIFICATE_NATURALLY_EXPIRED: "certificate_naturally_expired",
  SHORT_INACTIVITY_COURSE: "short_inactivity_course",
  SHORT_INACTIVITY_PLATFORM: "short_inactivity_platform",
  LONG_INACTIVITY_COURSE: "long_inactivity_course",
  LONG_INACTIVITY_PLATFORM: "long_inactivity_platform",
  DEADLINE_TODAY: "deadline_today",
  DEADLINE_TOMORROW: "deadline_tomorrow",
  DEADLINE_UPCOMING: "deadline_upcoming",
  WELCOME: "welcome",
  PASSWORD_RECOVERY: "password_recovery",
  PASSWORD_REMINDER: "password_reminder",
  USER_INVITE: "user_invite",
  USER_FIRST_LOGIN: "user_first_login",
  USER_FINISHED_CHAPTER: "user_finished_chapter",
  CERTIFICATE_EXPIRATION_WARNING: "certificate_expiration_warning",
  ADMIN_NEW_USER: "admin_new_user",
  ADMIN_FINISHED_COURSE: "admin_finished_course",
  ADMIN_OVERDUE_COURSES: "admin_overdue_courses",
  MAGIC_LINK: "magic_link",
  COURSE_CHAT_MENTION: "course_chat_mention",
  ANNOUNCEMENT: "announcement",
  LIVE_TRAINING_STARTED: "live_training_started",
  LIVE_TRAINING_REMINDER: "live_training_reminder",
  LIVE_TRAINING_ENDED: "live_training_ended",
} as const;

export const AUTOMATION_RUN_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  WARNINGS: "warnings",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const AUTOMATION_EMAIL_DELIVERY_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  RETRYING: "retrying",
  SKIPPED: "skipped",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const AUTOMATION_PLACEHOLDER_TYPES = {
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  URL: "url",
  LOCALIZED_STRING: "localized_string",
  COLLECTION: "collection",
} as const;

export const AUTOMATION_MAX_EMAIL_DELIVERY_ATTEMPTS = 3;
export const AUTOMATION_RUN_RETENTION_DAYS = 90;
export const AUTOMATION_RESERVED_BRANDING_PLACEHOLDER = "company_name";

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[keyof typeof AUTOMATION_STATUSES];
export type AutomationStepType = (typeof AUTOMATION_STEP_TYPES)[keyof typeof AUTOMATION_STEP_TYPES];
export type AutomationEventKind =
  (typeof AUTOMATION_EVENT_KINDS)[keyof typeof AUTOMATION_EVENT_KINDS];
export type BuiltInEmailTemplateKey =
  (typeof BUILT_IN_EMAIL_TEMPLATE_KEYS)[keyof typeof BUILT_IN_EMAIL_TEMPLATE_KEYS];
export type AutomationRunStatus =
  (typeof AUTOMATION_RUN_STATUSES)[keyof typeof AUTOMATION_RUN_STATUSES];
export type AutomationEmailDeliveryStatus =
  (typeof AUTOMATION_EMAIL_DELIVERY_STATUSES)[keyof typeof AUTOMATION_EMAIL_DELIVERY_STATUSES];
export type AutomationPlaceholderType =
  (typeof AUTOMATION_PLACEHOLDER_TYPES)[keyof typeof AUTOMATION_PLACEHOLDER_TYPES];

export const AUTOMATION_TEMPLATE_TYPES = { BUILTIN: "builtin", CUSTOM: "custom" } as const;
export const AUTOMATION_RECIPIENT_TYPES = {
  EVENT: "event",
  USER: "user",
  GROUP: "group",
  ROLE: "role",
  EVERYONE: "everyone",
} as const;
export const AUTOMATION_DEFINITION_KINDS = { DRAFT: "draft", APPLIED: "applied" } as const;
export const AUTOMATION_NODE_KINDS = {
  ACTION: "action",
  CONDITION: "condition",
  TRIGGER: "trigger",
} as const;
export const ACCOUNT_ACTION_KINDS = {
  CREATE_PASSWORD: "create_password",
  RESET_PASSWORD: "reset_password",
  SIGN_IN: "sign_in",
} as const;

export const AUTOMATION_FIELD_SENSITIVITIES = {
  ORDINARY: "ordinary",
  ACCOUNT_ACTION_LINK: "account_action_link",
} as const;

export type AutomationRecipientType =
  (typeof AUTOMATION_RECIPIENT_TYPES)[keyof typeof AUTOMATION_RECIPIENT_TYPES];

export const AUTOMATION_VALIDATION_ISSUE_CODES = {
  CROSS_AUTOMATION_REFERENCE: "cross_automation_reference",
  CYCLE: "cycle",
  DISCONNECTED_STEP: "disconnected_step",
  DUPLICATE_STEP_ID: "duplicate_step_id",
  FIELD_UNAVAILABLE_ON_BRANCH: "field_unavailable_on_branch",
  INVALID_CONDITION_BRANCHES: "invalid_condition_branches",
  INVALID_CONDITION_FIELD: "invalid_condition_field",
  INVALID_CONDITION_VALUE: "invalid_condition_value",
  INVALID_POSITION: "invalid_position",
  INVALID_ROOT: "invalid_root",
  INVALID_SAMPLE: "invalid_sample",
  INVALID_STEP_ID: "invalid_step_id",
  INVALID_SUCCESSOR: "invalid_successor",
  INVALID_TEMPLATE: "invalid_template",
  INVALID_TEMPLATE_MAPPING: "invalid_template_mapping",
  INVALID_TRIGGER_ROOT: "invalid_trigger_root",
  MAPPING_TYPE_MISMATCH: "mapping_type_mismatch",
  MISSING_ACCOUNT_ACTION: "missing_account_action",
  MISSING_ACTION: "missing_action",
  MISSING_CONDITION_FIELD: "missing_condition_field",
  MISSING_EVENT: "missing_event",
  MISSING_MAPPING: "missing_mapping",
  MISSING_PARENT: "missing_parent",
  MISSING_TEMPLATE: "missing_template",
  MISSING_TRIGGER: "missing_trigger",
  NON_ROOT_TRIGGER: "non_root_trigger",
  RESERVED_MAPPING: "reserved_mapping",
  SELF_PARENT: "self_parent",
  UNAVAILABLE_RECIPIENTS: "unavailable_recipients",
  UNAVAILABLE_TEMPLATE: "unavailable_template",
  UNKNOWN_EVENT_FIELD: "unknown_event_field",
  UNKNOWN_PLACEHOLDER: "unknown_placeholder",
  UNSAFE_ACCOUNT_ACTION_RECIPIENTS: "unsafe_account_action_recipients",
  UNSUPPORTED_STEP_TYPE: "unsupported_step_type",
} as const;

export type AutomationValidationIssueCode =
  (typeof AUTOMATION_VALIDATION_ISSUE_CODES)[keyof typeof AUTOMATION_VALIDATION_ISSUE_CODES];

export const AUTOMATION_CONDITION_BRANCH_POSITIONS = { YES: 0, NO: 1 } as const;
