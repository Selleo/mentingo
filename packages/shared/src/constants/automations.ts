export const AUTOMATION_TRIGGER_TYPES = [
  // User & Activity
  "user_invited",
  "users_imported_invite",
  "user_password_reminder",
  "user_welcome",
  "user_first_login",
  "users_assigned_to_course",
  "users_short_inactivity",
  "users_long_inactivity",
  "user_chapter_finished",
  "user_course_finished",
  // Admin events
  "user_registered",
  "user_password_created",
  "course_completed",
  // Certificates
  "certificate_expiration_warning",
  "certificate_archived",
  // Announcements
  "announcement_published",
  // Chat
  "course_chat_user_mentioned",
  // Due dates
  "course_due_date_reminder",
] as const;

export type TriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = ["send_email"] as const;

export type ActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const AUTOMATION_NODE_KINDS = ["trigger", "action"] as const;

export type NodeKind = (typeof AUTOMATION_NODE_KINDS)[number];

export const AUTOMATION_STATUSES = ["enabled", "disabled", "archived", "draft"] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

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

// ==========================================
// TRIGGER DEFINITIONS
// ==========================================

const USER_INVITED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_invited",
  labelKey: "automationBuilder.blocks.userInvited",
  icon: "user-plus",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "inviteLink", labelKey: "Link aktywacyjny" },
  ],
};

const USERS_IMPORTED_INVITE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_imported_invite",
  labelKey: "automationBuilder.blocks.usersImportedInvite",
  icon: "upload",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "inviteLink", labelKey: "Link do rejestracji" },
  ],
};

const USER_PASSWORD_REMINDER_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_reminder",
  labelKey: "automationBuilder.blocks.userPasswordReminder",
  icon: "key",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "resetPasswordLink", labelKey: "Link do resetu hasła" },
  ],
};

const USER_WELCOME_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_welcome",
  labelKey: "automationBuilder.blocks.userWelcome",
  icon: "sparkles",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "platformUrl", labelKey: "Link do platformy" },
  ],
};

const USER_FIRST_LOGIN_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_first_login",
  labelKey: "automationBuilder.blocks.userFirstLogin",
  icon: "log-in",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "loginDate", labelKey: "Data pierwszego zalogowania" },
  ],
};

const USERS_ASSIGNED_TO_COURSE_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_assigned_to_course",
  labelKey: "automationBuilder.blocks.usersAssignedToCourse",
  icon: "book-open",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "courseUrl", labelKey: "Link do kursu" },
    { key: "dueDate", labelKey: "Termin ukończenia" },
  ],
};

const USERS_SHORT_INACTIVITY_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_short_inactivity",
  labelKey: "automationBuilder.blocks.usersShortInactivity",
  icon: "user-x",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "courseUrl", labelKey: "Link do kursu" },
    { key: "daysInactive", labelKey: "Liczba dni nieaktywności" },
  ],
};

const USERS_LONG_INACTIVITY_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "users_long_inactivity",
  labelKey: "automationBuilder.blocks.usersLongInactivity",
  icon: "user-x",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "courseUrl", labelKey: "Link do kursu" },
    { key: "daysInactive", labelKey: "Liczba dni nieaktywności" },
  ],
};

const USER_CHAPTER_FINISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_chapter_finished",
  labelKey: "automationBuilder.blocks.userChapterFinished",
  icon: "check-circle",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "chapterName", labelKey: "Nazwa rozdziału" },
    { key: "courseUrl", labelKey: "Link do kursu" },
  ],
};

const USER_COURSE_FINISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_course_finished",
  labelKey: "automationBuilder.blocks.userCourseFinished",
  icon: "graduation-cap",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "finishedAt", labelKey: "Data ukończenia" },
    { key: "certificateUrl", labelKey: "Link do certyfikatu" },
  ],
};
const USER_REGISTERED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_registered",
  labelKey: "automationBuilder.blocks.userRegistered",
  icon: "user-check",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "registrationDate", labelKey: "Data rejestracji" },
  ],
};

const USER_PASSWORD_CREATED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "user_password_created",
  labelKey: "automationBuilder.blocks.userPasswordCreated",
  icon: "shield",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "createdAt", labelKey: "Data utworzenia" },
  ],
};

const COURSE_COMPLETED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_completed",
  labelKey: "automationBuilder.blocks.courseCompleted",
  icon: "trophy",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "finishedAt", labelKey: "Data ukończenia" },
  ],
};

const CERTIFICATE_EXPIRATION_WARNING_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_expiration_warning",
  labelKey: "automationBuilder.blocks.certificateExpirationWarning",
  icon: "award",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "certificateName", labelKey: "Nazwa certyfikatu" },
    { key: "expirationDate", labelKey: "Data wygaśnięcia" },
    { key: "daysLeft", labelKey: "Liczba dni do wygaśnięcia" },
  ],
};

const CERTIFICATE_ARCHIVED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "certificate_archived",
  labelKey: "automationBuilder.blocks.certificateArchived",
  icon: "archive",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "certificateName", labelKey: "Nazwa certyfikatu" },
    { key: "archivedAt", labelKey: "Data archiwizacji" },
  ],
};

const ANNOUNCEMENT_PUBLISHED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "announcement_published",
  labelKey: "automationBuilder.blocks.announcementPublished",
  icon: "megaphone",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię odbiorcy" },
    { key: "userLastName", labelKey: "Nazwisko odbiorcy" },
    { key: "announcementTitle", labelKey: "Tytuł ogłoszenia" },
    { key: "announcementContent", labelKey: "Treść ogłoszenia" },
    { key: "announcementUrl", labelKey: "Link do ogłoszenia" },
  ],
};

const COURSE_CHAT_USER_MENTIONED_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_chat_user_mentioned",
  labelKey: "automationBuilder.blocks.courseChatUserMentioned",
  icon: "at-sign",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię oznaczonego" },
    { key: "userLastName", labelKey: "Nazwisko oznaczonego" },
    { key: "authorFullName", labelKey: "Imię i nazwisko autora" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "messageContent", labelKey: "Treść wiadomości" },
    { key: "chatUrl", labelKey: "Link do wiadomości" },
  ],
};

const COURSE_DUE_DATE_REMINDER_TRIGGER: AutomationStepDefinition = {
  kind: "trigger",
  type: "course_due_date_reminder",
  labelKey: "automationBuilder.blocks.courseDueDateReminder",
  icon: "calendar-clock",
  color: "blue",
  providedVariables: [
    { key: "userFirstName", labelKey: "Imię użytkownika" },
    { key: "userLastName", labelKey: "Nazwisko użytkownika" },
    { key: "userEmail", labelKey: "Adres e-mail" },
    { key: "courseName", labelKey: "Nazwa kursu" },
    { key: "dueDate", labelKey: "Termin ukończenia" },
    { key: "daysLeft", labelKey: "Liczba dni do końca" },
    { key: "courseUrl", labelKey: "Link do kursu" },
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
  USER_REGISTERED_TRIGGER,
  USER_PASSWORD_CREATED_TRIGGER,
  COURSE_COMPLETED_TRIGGER,
  CERTIFICATE_EXPIRATION_WARNING_TRIGGER,
  CERTIFICATE_ARCHIVED_TRIGGER,
  ANNOUNCEMENT_PUBLISHED_TRIGGER,
  COURSE_CHAT_USER_MENTIONED_TRIGGER,
  COURSE_DUE_DATE_REMINDER_TRIGGER,
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
export const AUTOMATION_TRIGGER_MAP: Record<TriggerType, AutomationStepDefinition> = {
  user_invited: USER_INVITED_TRIGGER,
  users_imported_invite: USERS_IMPORTED_INVITE_TRIGGER,
  user_password_reminder: USER_PASSWORD_REMINDER_TRIGGER,
  user_welcome: USER_WELCOME_TRIGGER,
  user_first_login: USER_FIRST_LOGIN_TRIGGER,
  users_assigned_to_course: USERS_ASSIGNED_TO_COURSE_TRIGGER,
  users_short_inactivity: USERS_SHORT_INACTIVITY_TRIGGER,
  users_long_inactivity: USERS_LONG_INACTIVITY_TRIGGER,
  user_chapter_finished: USER_CHAPTER_FINISHED_TRIGGER,
  user_course_finished: USER_COURSE_FINISHED_TRIGGER,

  user_registered: USER_REGISTERED_TRIGGER,
  user_password_created: USER_PASSWORD_CREATED_TRIGGER,
  course_completed: COURSE_COMPLETED_TRIGGER,

  certificate_expiration_warning: CERTIFICATE_EXPIRATION_WARNING_TRIGGER,
  certificate_archived: CERTIFICATE_ARCHIVED_TRIGGER,

  announcement_published: ANNOUNCEMENT_PUBLISHED_TRIGGER,

  course_chat_user_mentioned: COURSE_CHAT_USER_MENTIONED_TRIGGER,

  course_due_date_reminder: COURSE_DUE_DATE_REMINDER_TRIGGER,
};
