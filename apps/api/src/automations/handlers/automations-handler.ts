import { Injectable } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";

import { AutomationEventNames } from "src/announcements/types/automations.types";
import {
  AnnouncementPublishedEvent,
  CertificateArchivedEmailEvent,
  CertificateExpirationWarningEmailEvent,
  CourseChatUserMentionedEvent,
  CourseCompletedEvent,
  CourseDueDateReminderEmailEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
  UserFirstLoginEvent,
  UserInviteEvent,
  UserPasswordCreatedEvent,
  UserPasswordReminderEvent,
  UserRegisteredEvent,
  UsersAssignedToCourseEvent,
  UsersImportInviteEmailsEvent,
  UsersLongInactivityEvent,
  UsersShortInactivityEvent,
  UserWelcomeEvent,
} from "src/events";

import type { IEventHandler } from "@nestjs/cqrs";

export type AutomationEventTypes =
  | UserInviteEvent
  | UsersImportInviteEmailsEvent
  | UserPasswordReminderEvent
  | UserWelcomeEvent
  | UserFirstLoginEvent
  | UsersAssignedToCourseEvent
  | UsersShortInactivityEvent
  | UsersLongInactivityEvent
  | UserChapterFinishedEvent
  | UserCourseFinishedEvent
  | UserRegisteredEvent
  | UserPasswordCreatedEvent
  | CourseCompletedEvent
  | CertificateExpirationWarningEmailEvent
  | CertificateArchivedEmailEvent
  | AnnouncementPublishedEvent
  | CourseChatUserMentionedEvent
  | CourseDueDateReminderEmailEvent;

export const AutomationEvents = [
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
] as const;

@Injectable()
@EventsHandler(...AutomationEvents)
export class AutomationsHandler implements IEventHandler<AutomationEventTypes> {
  handle(event: AutomationEventTypes) {
    const eventName = AutomationEventNames[event.constructor.name];
    console.log(eventName);
  }
}
