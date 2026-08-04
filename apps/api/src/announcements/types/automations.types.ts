import {
  UserInviteEvent,
  UsersImportInviteEmailsEvent,
  UserPasswordReminderEvent,
  UserWelcomeEvent,
  UserFirstLoginEvent,
  UsersAssignedToCourseEvent,
  UsersShortInactivityEvent,
  UsersLongInactivityEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
  UserRegisteredEvent,
  UserPasswordCreatedEvent,
  CourseCompletedEvent,
  CertificateExpirationWarningEmailEvent,
  CertificateArchivedEmailEvent,
  AnnouncementPublishedEvent,
  CourseChatUserMentionedEvent,
  CourseDueDateReminderEmailEvent,
} from "src/events";

import type { AutomationEventTypes } from "src/automations/handlers/automations-handler";

export enum AutomationStatus {
  Enabled = "enabled",
  Disabled = "disabled",
  Archived = "archived",
  Draft = "draft",
}

export const automationTypes = ["action", "condition", "trigger"] as const;

export type AutomationType = (typeof automationTypes)[number];

export const AutomationStepType = {
  Action: "action",
  Condition: "condition",
  Trigger: "trigger",
} as const;

export const AutomationEventNames: Record<AutomationEventTypes["constructor"]["name"], string> = {
  [UserInviteEvent.name]: "user_invited",
  [UsersImportInviteEmailsEvent.name]: "users_imported_invite",
  [UserPasswordReminderEvent.name]: "user_password_reminder",
  [UserWelcomeEvent.name]: "user_welcome",
  [UserFirstLoginEvent.name]: "user_first_login",
  [UsersAssignedToCourseEvent.name]: "users_assigned_to_course",
  [UsersShortInactivityEvent.name]: "users_short_inactivity",
  [UsersLongInactivityEvent.name]: "users_long_inactivity",
  [UserChapterFinishedEvent.name]: "user_chapter_finished",
  [UserCourseFinishedEvent.name]: "user_course_finished",
  [UserRegisteredEvent.name]: "user_registered",
  [UserPasswordCreatedEvent.name]: "user_password_created",
  [CourseCompletedEvent.name]: "course_completed",
  [CertificateExpirationWarningEmailEvent.name]: "certificate_expiration_warning",
  [CertificateArchivedEmailEvent.name]: "certificate_archived",
  [AnnouncementPublishedEvent.name]: "announcement_published",
  [CourseChatUserMentionedEvent.name]: "course_chat_user_mentioned",
  [CourseDueDateReminderEmailEvent.name]: "course_due_date_reminder",
};
