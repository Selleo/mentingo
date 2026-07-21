export type TriggerType =
  // User & Activity
  | "user_invited"
  | "users_imported_invite"
  | "user_password_reminder"
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

export interface PayloadVariable {
  key: string;
  labelKey: string;
  dataType?: "string" | "number" | "date" | "url";
}

export interface AutomationStepDefinition {
  kind: NodeKind;
  type: TriggerType | ActionType;
  labelKey: string;
  icon:
    | "user-plus"
    | "upload"
    | "key"
    | "lock"
    | "sparkles"
    | "log-in"
    | "book-open"
    | "user-x"
    | "check-circle"
    | "graduation-cap"
    | "user-check"
    | "shield"
    | "trophy"
    | "award"
    | "archive"
    | "megaphone"
    | "at-sign"
    | "calendar-clock"
    | "mail";
  color: "blue" | "emerald";
  providedVariables?: PayloadVariable[];
}
// 1. NotifyUsersHandler
const USER_INVITED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_invited",
  labelKey: "automationBuilder.blocks.userInvited",
  icon: "user-plus",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "invite_link", labelKey: "Link aktywacyjny" },
  ],
};

const USERS_IMPORTED_INVITE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_imported_invite",
  labelKey: "automationBuilder.blocks.usersImportedInvite",
  icon: "upload",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "invite_link", labelKey: "Link do rejestracji" },
  ],
};

const USER_PASSWORD_REMINDER_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_reminder",
  labelKey: "automationBuilder.blocks.userPasswordReminder",
  icon: "key",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "reset_password_link", labelKey: "Link do resetu hasła" },
  ],
};

const USER_WELCOME_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_welcome",
  labelKey: "automationBuilder.blocks.userWelcome",
  icon: "sparkles",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "platform_url", labelKey: "Link do platformy" },
  ],
};

const USER_FIRST_LOGIN_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_first_login",
  labelKey: "automationBuilder.blocks.userFirstLogin",
  icon: "log-in",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "login_date", labelKey: "Data pierwszego zalogowania" },
  ],
};

const USERS_ASSIGNED_TO_COURSE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_assigned_to_course",
  labelKey: "automationBuilder.blocks.usersAssignedToCourse",
  icon: "book-open",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "course_url", labelKey: "Link do kursu" },
    { key: "due_date", labelKey: "Termin ukończenia" },
  ],
};

const USERS_SHORT_INACTIVITY_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_short_inactivity",
  labelKey: "automationBuilder.blocks.usersShortInactivity",
  icon: "user-x",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "course_url", labelKey: "Link do kursu" },
    { key: "days_inactive", labelKey: "Liczba dni nieaktywności" },
  ],
};

const USERS_LONG_INACTIVITY_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_long_inactivity",
  labelKey: "automationBuilder.blocks.usersLongInactivity",
  icon: "user-x",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "course_url", labelKey: "Link do kursu" },
    { key: "days_inactive", labelKey: "Liczba dni nieaktywności" },
  ],
};

const USER_CHAPTER_FINISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_chapter_finished",
  labelKey: "automationBuilder.blocks.userChapterFinished",
  icon: "check-circle",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "chapter_name", labelKey: "Nazwa rozdziału" },
    { key: "course_url", labelKey: "Link do kursu" },
  ],
};

const USER_COURSE_FINISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_course_finished",
  labelKey: "automationBuilder.blocks.userCourseFinished",
  icon: "graduation-cap",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "finished_at", labelKey: "Data ukończenia" },
    { key: "certificate_url", labelKey: "Link do certyfikatu" },
  ],
};

// 2. NotifyAdminsHandler
const USER_REGISTERED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_registered",
  labelKey: "automationBuilder.blocks.userRegistered",
  icon: "user-check",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "registration_date", labelKey: "Data rejestracji" },
  ],
};

const USER_PASSWORD_CREATED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_created",
  labelKey: "automationBuilder.blocks.userPasswordCreated",
  icon: "shield",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "created_at", labelKey: "Data utworzenia" },
  ],
};

const COURSE_COMPLETED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_completed",
  labelKey: "automationBuilder.blocks.courseCompleted",
  icon: "trophy",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "finished_at", labelKey: "Data ukończenia" },
  ],
};

// 3. CertificateEmailHandler
const CERTIFICATE_EXPIRATION_WARNING_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_expiration_warning",
  labelKey: "automationBuilder.blocks.certificateExpirationWarning",
  icon: "award",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "certificate_name", labelKey: "Nazwa certyfikatu" },
    { key: "expiration_date", labelKey: "Data wygaśnięcia" },
    { key: "days_left", labelKey: "Liczba dni do wygaśnięcia" },
  ],
};

const CERTIFICATE_ARCHIVED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_archived",
  labelKey: "automationBuilder.blocks.certificateArchived",
  icon: "archive",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "certificate_name", labelKey: "Nazwa certyfikatu" },
    { key: "archived_at", labelKey: "Data archiwizacji" },
  ],
};

// 4. AnnouncementEmailHandler
const ANNOUNCEMENT_PUBLISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "announcement_published",
  labelKey: "automationBuilder.blocks.announcementPublished",
  icon: "megaphone",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię odbiorcy" },
    { key: "user_last_name", labelKey: "Nazwisko odbiorcy" },
    { key: "announcement_title", labelKey: "Tytuł ogłoszenia" },
    { key: "announcement_content", labelKey: "Treść ogłoszenia" },
    { key: "announcement_url", labelKey: "Link do ogłoszenia" },
  ],
};

// 5. CourseChatMentionEmailHandler
const COURSE_CHAT_USER_MENTIONED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_chat_user_mentioned",
  labelKey: "automationBuilder.blocks.courseChatUserMentioned",
  icon: "at-sign",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię oznaczonego" },
    { key: "user_last_name", labelKey: "Nazwisko oznaczonego" },
    { key: "author_full_name", labelKey: "Imię i nazwisko autora" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "message_content", labelKey: "Treść wiadomości" },
    { key: "chat_url", labelKey: "Link do wiadomości" },
  ],
};

// 6. CourseDueDateReminderEmailHandler
const COURSE_DUE_DATE_REMINDER_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_due_date_reminder",
  labelKey: "automationBuilder.blocks.courseDueDateReminder",
  icon: "calendar-clock",
  color: "blue",
  providedVariables: [
    { key: "user_first_name", labelKey: "Imię użytkownika" },
    { key: "user_last_name", labelKey: "Nazwisko użytkownika" },
    { key: "user_email", labelKey: "Adres e-mail" },
    { key: "course_name", labelKey: "Nazwa kursu" },
    { key: "due_date", labelKey: "Termin ukończenia" },
    { key: "days_left", labelKey: "Liczba dni do końca" },
    { key: "course_url", labelKey: "Link do kursu" },
  ],
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
