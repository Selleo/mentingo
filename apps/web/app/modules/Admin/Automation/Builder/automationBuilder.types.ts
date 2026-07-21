export type TriggerType =
  // User & Activity
  | "user_invited"
  | "users_imported_invite"
  | "user_password_reminder"
  | "user_password_changed"
  | "user_welcome"
  | "user_first_login"
  | "users_assigned_to_course"
  | "users_short_inactivity"
  | "users_long_inactivity"
  | "user_chapter_finished"
  | "user_course_finished"
  // Admin events
  | "user_registered"
  | "user_password_created"
  | "course_completed"
  // Certificates
  | "certificate_expiration_warning"
  | "certificate_archived"
  //Announcements
  | "announcement_published"
  //Chat
  | "course_chat_user_mentioned"
  //Due dates
  | "course_due_date_reminder";

export type ActionType = "send_email";

export type NodeKind = "trigger" | "action";

export interface StepConfigField {
  key: string;
  labelKey: string;
  type: "text" | "number" | "select" | "multiselect" | "textarea" | "emailTemplateSelect";
  placeholderKey?: string;
  options?: { value: string; labelKey: string; label?: string; imageUrl?: string }[];
  dataSource?: "courses" | "users" | "announcements";
}

export interface AutomationStepDefinition {
  kind: NodeKind;
  type: TriggerType | ActionType;
  labelKey: string;
  icon: string;
  color: "blue" | "emerald";
}

const USER_INVITED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_invited",
  labelKey: "automationBuilder.blocks.userInvited",
  icon: "user-plus",
  color: "blue",
};

const USERS_IMPORTED_INVITE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_imported_invite",
  labelKey: "automationBuilder.blocks.usersImportedInvite",
  icon: "file-up",
  color: "blue",
};

const USER_PASSWORD_REMINDER_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_reminder",
  labelKey: "automationBuilder.blocks.userPasswordReminder",
  icon: "key-round",
  color: "blue",
};

const USER_PASSWORD_CHANGED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_changed",
  labelKey: "automationBuilder.blocks.userPasswordChanged",
  icon: "lock",
  color: "blue",
};

const USER_WELCOME_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_welcome",
  labelKey: "automationBuilder.blocks.userWelcome",
  icon: "sparkles",
  color: "blue",
};

const USER_FIRST_LOGIN_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_first_login",
  labelKey: "automationBuilder.blocks.userFirstLogin",
  icon: "log-in",
  color: "blue",
};

const USERS_ASSIGNED_TO_COURSE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_assigned_to_course",
  labelKey: "automationBuilder.blocks.usersAssignedToCourse",
  icon: "book-open-check",
  color: "blue",
};

const USERS_SHORT_INACTIVITY_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_short_inactivity",
  labelKey: "automationBuilder.blocks.usersShortInactivity",
  icon: "user-x",
  color: "blue",
};

const USERS_LONG_INACTIVITY_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_long_inactivity",
  labelKey: "automationBuilder.blocks.usersLongInactivity",
  icon: "user-minus",
  color: "blue",
};

const USER_CHAPTER_FINISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_chapter_finished",
  labelKey: "automationBuilder.blocks.userChapterFinished",
  icon: "check-circle-2",
  color: "blue",
};

const USER_COURSE_FINISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_course_finished",
  labelKey: "automationBuilder.blocks.userCourseFinished",
  icon: "graduation-cap",
  color: "blue",
};

// NotifyAdminsHandler
const USER_REGISTERED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_registered",
  labelKey: "automationBuilder.blocks.userRegistered",
  icon: "user-check",
  color: "blue",
};

const USER_PASSWORD_CREATED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_created",
  labelKey: "automationBuilder.blocks.userPasswordCreated",
  icon: "shield-check",
  color: "blue",
};

const COURSE_COMPLETED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_completed",
  labelKey: "automationBuilder.blocks.courseCompleted",
  icon: "trophy",
  color: "blue",
};

// CertificateEmailHandler
const CERTIFICATE_EXPIRATION_WARNING_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_expiration_warning",
  labelKey: "automationBuilder.blocks.certificateExpirationWarning",
  icon: "award",
  color: "blue",
};

const CERTIFICATE_ARCHIVED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_archived",
  labelKey: "automationBuilder.blocks.certificateArchived",
  icon: "archive",
  color: "blue",
};

//AnnouncementEmailHandler
const ANNOUNCEMENT_PUBLISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "announcement_published",
  labelKey: "automationBuilder.blocks.announcementPublished",
  icon: "megaphone",
  color: "blue",
};

// CourseChatMentionEmailHandler
const COURSE_CHAT_USER_MENTIONED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_chat_user_mentioned",
  labelKey: "automationBuilder.blocks.courseChatUserMentioned",
  icon: "at-sign",
  color: "blue",
};

// CourseDueDateReminderEmailHandler
const COURSE_DUE_DATE_REMINDER_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_due_date_reminder",
  labelKey: "automationBuilder.blocks.courseDueDateReminder",
  icon: "calendar-clock",
  color: "blue",
};

// ==========================================
// ACTION DEFINITIONS
// ==========================================

const SEND_EMAIL_ACTION: AutomationStepDefinition = {
  kind: "action",
  type: "send_email",
  labelKey: "automationBuilder.blocks.sendEmail",
  icon: "mail",
  color: "emerald",
};

// ==========================================
// EXPORTS & HELPERS
// ==========================================

export const STEP_DEFINITIONS: AutomationStepDefinition[] = [
  // User events
  USER_INVITED_TRIGGER,
  USERS_IMPORTED_INVITE_TRIGGER,
  USER_PASSWORD_REMINDER_TRIGGER,
  USER_PASSWORD_CHANGED_TRIGGER,
  USER_WELCOME_TRIGGER,
  USER_FIRST_LOGIN_TRIGGER,
  USERS_ASSIGNED_TO_COURSE_TRIGGER,
  USERS_SHORT_INACTIVITY_TRIGGER,
  USERS_LONG_INACTIVITY_TRIGGER,
  USER_CHAPTER_FINISHED_TRIGGER,
  USER_COURSE_FINISHED_TRIGGER,
  // Admin events
  USER_REGISTERED_TRIGGER,
  USER_PASSWORD_CREATED_TRIGGER,
  COURSE_COMPLETED_TRIGGER,
  // Certificates
  CERTIFICATE_EXPIRATION_WARNING_TRIGGER,
  CERTIFICATE_ARCHIVED_TRIGGER,
  // Announcements
  ANNOUNCEMENT_PUBLISHED_TRIGGER,
  // Chat
  COURSE_CHAT_USER_MENTIONED_TRIGGER,
  // Due dates
  COURSE_DUE_DATE_REMINDER_TRIGGER,
  // Actions
  SEND_EMAIL_ACTION,
];

export const TRIGGER_DEFINITIONS = STEP_DEFINITIONS.filter(
  (s): s is AutomationStepDefinition & { kind: "trigger" } => s.kind === "trigger",
);

export const ACTION_DEFINITIONS = STEP_DEFINITIONS.filter(
  (s): s is AutomationStepDefinition & { kind: "action" } => s.kind === "action",
);

export function getStepDefinition(
  type: TriggerType | ActionType,
): AutomationStepDefinition | undefined {
  return STEP_DEFINITIONS.find((s) => s.type === type);
}

export interface SidebarBlock {
  kind: NodeKind;
  type: TriggerType | ActionType;
  labelKey: string;
  icon: string;
}

export const TRIGGER_BLOCKS: SidebarBlock[] = TRIGGER_DEFINITIONS.map((d) => ({
  kind: d.kind,
  type: d.type,
  labelKey: d.labelKey,
  icon: d.icon,
}));

export const ACTION_BLOCKS: SidebarBlock[] = ACTION_DEFINITIONS.map((d) => ({
  kind: d.kind,
  type: d.type,
  labelKey: d.labelKey,
  icon: d.icon,
}));

export interface BuilderNode {
  id: string;
  kind: NodeKind;
  type: TriggerType | ActionType;
  label: string;
  parentId: string | null;
  children: string[];
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface BuilderState {
  nodes: BuilderNode[];
  selectedNodeId: string | null;
  automationName: string;
  isActive: boolean;
  lastSavedAt: string | null;
}
