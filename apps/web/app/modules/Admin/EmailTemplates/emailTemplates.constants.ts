import {
  AlignVerticalSpaceAround,
  Image,
  Minus,
  PanelBottom,
  PanelTop,
  RectangleHorizontal,
  Type,
  Pilcrow,
} from "lucide-react";

import type { EmailTemplate, EmailTemplateBlock, EmailTemplateEvent } from "./emailTemplates.types";

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

export const EMAIL_TEMPLATE_BLOCK_ICONS = {
  header: PanelTop,
  heading: Type,
  text: Pilcrow,
  button: RectangleHorizontal,
  image: Image,
  divider: Minus,
  spacer: AlignVerticalSpaceAround,
  footer: PanelBottom,
} as const;

export const EMAIL_TEMPLATE_DRAG_TYPES = {
  PALETTE: "palette",
  BLOCK: "block",
  INSERTION: "insertion",
} as const;

export const EMAIL_TEMPLATE_LIST_PATH = "/admin/email-templates";
export const EMAIL_TEMPLATE_STATUS_BADGE_ICONS = {
  system: undefined,
  draft: "Warning",
  published: "Success",
  archived: undefined,
} as const;
export const EMAIL_TEMPLATE_STATUS_BADGE_VARIANTS = {
  system: "notStarted",
  draft: "draft",
  published: "success",
  archived: "blocked",
} as const;
export const EMAIL_TEMPLATE_BLOCK_OPTIONS = Object.values(
  EMAIL_TEMPLATE_BLOCK_TYPES,
) satisfies EmailTemplateBlock["type"][];
export const EMAIL_TEMPLATE_EVENT_OPTIONS = [
  "welcome",
  "password_recovery",
  "password_reminder",
  "user_invite",
  "user_first_login",
  "user_assigned_to_course",
  "user_short_inactivity",
  "user_long_inactivity",
  "user_finished_chapter",
  "user_finished_course",
  "certificate_expiration_warning",
  "certificate_expired",
  "admin_new_user",
  "admin_finished_course",
  "admin_overdue_courses",
  "course_due_date_reminder",
  "magic_link",
  "course_chat_mention",
  "announcement",
  "live_training_started",
  "live_training_reminder",
  "live_training_ended",
] as const satisfies readonly EmailTemplateEvent[];
export const EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE = "application/x-mentingo-email-variable";

export const EMAIL_TEMPLATE_ACTIONS = {
  PUBLISH: "publish",
  ARCHIVE: "archive",
  DELETE: "delete",
} as const;

export const EMAIL_TEMPLATE_STATUSES = {
  SYSTEM: "system",
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export const EMAIL_TEMPLATE_SOURCES = {
  DEFAULT: "default",
  OVERRIDE: "override",
} as const satisfies Record<string, EmailTemplate["source"]>;

export const EMAIL_TEMPLATE_CONFIRMATION_HINTS = {
  [EMAIL_TEMPLATE_ACTIONS.PUBLISH]: "emailTemplates.ui.publishHint",
  [EMAIL_TEMPLATE_ACTIONS.ARCHIVE]: "emailTemplates.ui.archiveHint",
  [EMAIL_TEMPLATE_ACTIONS.DELETE]: "emailTemplates.ui.deleteHint",
} as const;
