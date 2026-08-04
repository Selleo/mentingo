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

import { AutomationRunnerService } from "../automation-runner/automation-runner.service";
import { AutomationStepsRepository } from "../repositories/automation-steps/automation-steps.repository";

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
  constructor(
    private readonly automationStepsRepository: AutomationStepsRepository,
    private readonly automationRunnerService: AutomationRunnerService,
  ) {}
  async handle(event: AutomationEventTypes) {
    const eventName = AutomationEventNames[event.constructor.name];
    const triggers = await this.automationStepsRepository.findAutomationTriggerToRun(eventName);
    const automationIds = triggers.map((step) => step.automationId);
    const uniqueAutomationIds = [...new Set(automationIds)];

    for (const automationId of uniqueAutomationIds) {
      await this.automationRunnerService.startAutomation(automationId, event);
    }
  }
}
