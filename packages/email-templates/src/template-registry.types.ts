import type { SupportedLanguages } from "@repo/shared";

import type { EmailContent } from "./types";

export const EMAIL_TEMPLATE_BLOCK_TYPES = {
  HEADER: "header",
  HEADING: "heading",
  TEXT: "text",
  BUTTON: "button",
  IMAGE: "image",
  DIVIDER: "divider",
  SPACER: "spacer",
  FOOTER: "footer",
} as const;

export type EmailTemplateBlockType =
  (typeof EMAIL_TEMPLATE_BLOCK_TYPES)[keyof typeof EMAIL_TEMPLATE_BLOCK_TYPES];

export const EMAIL_TEMPLATE_EVENTS = {
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

export type EmailTemplateEvent = (typeof EMAIL_TEMPLATE_EVENTS)[keyof typeof EMAIL_TEMPLATE_EVENTS];

export const EMAIL_TEMPLATE_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type EmailTemplateStatus =
  (typeof EMAIL_TEMPLATE_STATUSES)[keyof typeof EMAIL_TEMPLATE_STATUSES];

export const EMAIL_TEMPLATE_VARIABLE_TYPES = {
  TEXT: "text",
  URL: "url",
  NUMBER: "number",
  BOOLEAN: "boolean",
  DATE: "date",
  COLLECTION: "collection",
} as const;

export type EmailTemplateVariableType =
  (typeof EMAIL_TEMPLATE_VARIABLE_TYPES)[keyof typeof EMAIL_TEMPLATE_VARIABLE_TYPES];

export type EmailTemplateVariableValue = string | number | boolean | readonly unknown[];

export type EmailTemplateVariableDefinition = {
  key: string;
  label: string;
  type: EmailTemplateVariableType;
  required?: boolean;
  sampleValue: EmailTemplateVariableValue;
};

export const EMAIL_TEMPLATE_INLINE_MARK_TYPES = {
  BOLD: "bold",
  ITALIC: "italic",
  LINK: "link",
} as const;

export type EmailTemplateInlineMarkType =
  (typeof EMAIL_TEMPLATE_INLINE_MARK_TYPES)[keyof typeof EMAIL_TEMPLATE_INLINE_MARK_TYPES];

export type EmailTemplateInlineNode = {
  type: "text";
  text: string;
  marks?: readonly { type: EmailTemplateInlineMarkType; attrs?: Record<string, string> }[];
};

export type EmailTemplateParagraphNode = {
  type: "paragraph";
  content?: readonly EmailTemplateInlineNode[];
};

export type EmailTemplateBlockNode = {
  type: EmailTemplateBlockType;
  attrs?: Readonly<Record<string, string | number | boolean | null>>;
  content?: readonly EmailTemplateParagraphNode[];
};

export type EmailTemplateDocument = {
  type: "doc";
  content: readonly EmailTemplateBlockNode[];
};

export type LocalizedEmailTemplateContent = Partial<
  Record<SupportedLanguages, EmailTemplateDocument>
>;

export type LocalizedEmailValue<T> = Record<SupportedLanguages, T>;

export type CreateEmailTemplateDefinitionInput = {
  event: EmailTemplateEvent;
  name: string;
  description: string;
  sourceTemplate: string;
  subject: LocalizedEmailValue<string>;
  variables: readonly EmailTemplateVariableDefinition[];
  getContent: (language: SupportedLanguages) => EmailContent;
  buttonUrl: string;
};

export type EmailTemplateDefinition = {
  event: EmailTemplateEvent;
  name: string;
  description: string;
  sourceTemplate: string;
  defaultLanguage: "en";
  subjects: LocalizedEmailValue<string>;
  variables: readonly EmailTemplateVariableDefinition[];
  defaultDocuments: LocalizedEmailValue<EmailTemplateDocument>;
};
