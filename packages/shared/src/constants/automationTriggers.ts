import {
  AUTOMATION_NODE_KINDS,
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_FIELD_SENSITIVITIES,
  type AutomationEventKind,
  type AutomationPlaceholderType,
} from "./automations";
import type { AutomationProvidedVariable } from "../types/automations";

export type AutomationTriggerDefinition = {
  type: AutomationEventKind;
  kind: typeof AUTOMATION_NODE_KINDS.TRIGGER;
  labelKey: string;
  providedVariables: AutomationProvidedVariable[];
};

const getSampleValue = (dataType: AutomationPlaceholderType) => {
  if (dataType === AUTOMATION_PLACEHOLDER_TYPES.URL) return "https://example.invalid/example";
  if (dataType === AUTOMATION_PLACEHOLDER_TYPES.NUMBER) return 3;
  if (dataType === AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN) return true;

  return "Example";
};

const variable = (
  key: string,
  labelKey: string,
  dataType: AutomationPlaceholderType = AUTOMATION_PLACEHOLDER_TYPES.STRING,
  sourceKey = key,
): AutomationProvidedVariable => ({
  key,
  label: key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()),
  labelKey,
  dataType,
  sourceKey,
  sampleValue: getSampleValue(dataType),
  ...(["reset_link", "create_password_link", "magic_link"].includes(sourceKey)
    ? { sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK }
    : {}),
});

/** Trigger-owned builder keys alias values captured by the originating producer. */
export const AUTOMATION_TRIGGER_DEFINITIONS: AutomationTriggerDefinition[] = [
  {
    type: AUTOMATION_EVENT_KINDS.WELCOME,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userWelcome",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "platformUrl",
        "automationBuilder.variables.platformUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "courses_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.PASSWORD_RECOVERY,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userPasswordReminder",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "resetPasswordLink",
        "automationBuilder.variables.resetPasswordLink",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "reset_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.PASSWORD_REMINDER,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userPasswordReminder",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "resetPasswordLink",
        "automationBuilder.variables.resetPasswordLink",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "create_password_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_INVITE,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userInvited",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "inviteLink",
        "automationBuilder.variables.inviteLink",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "create_password_link",
      ),
      variable(
        "invitedByUserName",
        "automationBuilder.variables.invitedByUserName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "invited_by_user_name",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_FIRST_LOGIN,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userFirstLogin",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "loginDate",
        "automationBuilder.variables.loginDate",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "loginDate",
      ),
      variable(
        "platformUrl",
        "automationBuilder.variables.platformUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "courses_url",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_ASSIGNED_TO_COURSE,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.usersAssignedToCourse",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
      variable(
        "dueDate",
        "automationBuilder.variables.dueDate",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "formatted_course_due_date",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_SHORT_INACTIVITY,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.usersShortInactivity",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_LONG_INACTIVITY,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.usersLongInactivity",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_FINISHED_CHAPTER,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userChapterFinished",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "chapterName",
        "automationBuilder.variables.chapterName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "chapter_name",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userCourseFinished",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "hasCertificate",
        "automationBuilder.variables.hasCertificate",
        AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN,
        "has_certificate",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRATION_WARNING,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.certificateExpirationWarning",
    providedVariables: [
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "expirationDate",
        "automationBuilder.variables.expirationDate",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "expires_at",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRED,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.certificateArchived",
    providedVariables: [
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
      variable(
        "archiveReason",
        "automationBuilder.variables.archiveReason",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "reason",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.ADMIN_NEW_USER,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userRegistered",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.userFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.userLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "registrationDate",
        "automationBuilder.variables.registrationDate",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "registrationDate",
      ),
      variable(
        "profileLink",
        "automationBuilder.variables.profileLink",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "profile_link",
      ),
      variable(
        "userName",
        "automationBuilder.variables.userName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "user_name",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.courseCompleted",
    providedVariables: [
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "userName",
        "automationBuilder.variables.userName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "user_name",
      ),
      variable(
        "progressLink",
        "automationBuilder.variables.progressLink",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "progress_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.usersAssignedToCourse",
    providedVariables: [
      variable(
        "overdueCoursesSummary",
        "automationBuilder.variables.overdueCoursesSummary",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "overdue_courses_summary",
      ),
      variable(
        "platformUrl",
        "automationBuilder.variables.platformUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "courses_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.COURSE_DUE_DATE_REMINDER,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.courseDueDateReminder",
    providedVariables: [
      variable(
        "userEmail",
        "automationBuilder.variables.userEmail",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userEmail",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "dueDate",
        "automationBuilder.variables.dueDate",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "due_date",
      ),
      variable(
        "daysLeft",
        "automationBuilder.variables.daysLeft",
        AUTOMATION_PLACEHOLDER_TYPES.NUMBER,
        "days_before_due_date",
      ),
      variable(
        "courseUrl",
        "automationBuilder.variables.courseUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.MAGIC_LINK,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.userPasswordReminder",
    providedVariables: [
      variable(
        "magicLink",
        "automationBuilder.variables.magicLink",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "magic_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.COURSE_CHAT_MENTION,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.courseChatUserMentioned",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.mentionedFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.mentionedLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "authorFullName",
        "automationBuilder.variables.authorFullName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "authorFullName",
      ),
      variable(
        "courseName",
        "automationBuilder.variables.courseName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "course_name",
      ),
      variable(
        "messageContent",
        "automationBuilder.variables.messageContent",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "message",
      ),
      variable(
        "chatUrl",
        "automationBuilder.variables.chatUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "course_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.ANNOUNCEMENT,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.announcementPublished",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.recipientFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.recipientLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "announcementTitle",
        "automationBuilder.variables.announcementTitle",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "title",
      ),
      variable(
        "announcementContent",
        "automationBuilder.variables.announcementContent",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "content",
      ),
      variable(
        "announcementUrl",
        "automationBuilder.variables.announcementUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "button_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_STARTED,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.announcementPublished",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.recipientFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.recipientLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "announcementTitle",
        "automationBuilder.variables.announcementTitle",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "title",
      ),
      variable(
        "announcementContent",
        "automationBuilder.variables.announcementContent",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "content",
      ),
      variable(
        "announcementUrl",
        "automationBuilder.variables.announcementUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "live_training_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_REMINDER,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.announcementPublished",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.recipientFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.recipientLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "announcementTitle",
        "automationBuilder.variables.announcementTitle",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "title",
      ),
      variable(
        "announcementContent",
        "automationBuilder.variables.announcementContent",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "content",
      ),
      variable(
        "announcementUrl",
        "automationBuilder.variables.announcementUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "live_training_link",
      ),
    ],
  },
  {
    type: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_ENDED,
    kind: AUTOMATION_NODE_KINDS.TRIGGER,
    labelKey: "automationBuilder.blocks.announcementPublished",
    providedVariables: [
      variable(
        "userFirstName",
        "automationBuilder.variables.recipientFirstName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userFirstName",
      ),
      variable(
        "userLastName",
        "automationBuilder.variables.recipientLastName",
        AUTOMATION_PLACEHOLDER_TYPES.STRING,
        "userLastName",
      ),
      variable(
        "announcementTitle",
        "automationBuilder.variables.announcementTitle",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "title",
      ),
      variable(
        "announcementContent",
        "automationBuilder.variables.announcementContent",
        AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
        "content",
      ),
      variable(
        "announcementUrl",
        "automationBuilder.variables.announcementUrl",
        AUTOMATION_PLACEHOLDER_TYPES.URL,
        "live_training_link",
      ),
    ],
  },
];

export const getAutomationTriggerDefinition = (type: AutomationEventKind) =>
  AUTOMATION_TRIGGER_DEFINITIONS.find((definition) => definition.type === type);
