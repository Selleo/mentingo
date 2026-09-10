import {
  CERTIFICATE_ARCHIVE_REASONS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { snakeCase } from "lodash";

import type { EmailContent } from "./types";
import { EMAIL_SUBJECTS_TRANSLATIONS, type EmailSubjectKey } from "./email-subjects";

import { getAnnouncementEmailTranslations } from "./translations/announcementEmail";
import { getCertificateExpirationWarningEmailTranslations } from "./translations/certificateExpirationWarning";
import { getCertificateExpiredEmailTranslations } from "./translations/certificateExpired";
import { getCourseDueDateReminderEmailTranslations } from "./translations/courseDueDateReminder";
import { getCreatePasswordReminderEmailTranslations } from "./translations/createPasswordReminder";
import { getFinishedCourseEmailTranslations } from "./translations/finishedCourse";
import { getLiveTrainingEmailButtonText } from "./translations/liveTrainingEmail";
import { getMagicLinkEmailTranslations } from "./translations/magicLink";
import { getNewUserEmailTranslations } from "./translations/newUser";
import { getOverdueCoursesEmailTranslations } from "./translations/overdueCourses";
import { getPasswordRecoveryEmailTranslations } from "./translations/passwordRecovery";
import { getUserAssignedToCourseEmailTranslations } from "./translations/userAssignedToCourse";
import { getUserFinishedChapterEmailTranslations } from "./translations/userFinishedChapter";
import { getUserFinishedCourseEmailTranslations } from "./translations/userFinishedCourse";
import { getUserFirstLoginEmailTranslations } from "./translations/userFirstLogin";
import { getUserInviteEmailTranslations } from "./translations/userInvite";
import { getUserLongInactivityEmailTranslations } from "./translations/userLongInactivity";
import { getUserShortInactivityEmailTranslations } from "./translations/userShortInactivity";
import { getWelcomeEmailTranslations } from "./translations/welcome";

import {
  EMAIL_TEMPLATE_EVENTS,
  EMAIL_TEMPLATE_BLOCK_TYPES,
  type CreateEmailTemplateDefinitionInput,
  type EmailTemplateDefinition,
  type EmailTemplateDocument,
  type EmailTemplateEvent,
  type EmailTemplateVariableDefinition,
  type LocalizedEmailValue,
} from "./template-registry.types";

const buildLocalizedValuesForSupportedLanguages = <T>(
  factory: (language: SupportedLanguages) => T,
): LocalizedEmailValue<T> => {
  return Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [language, factory(language)]),
  ) as LocalizedEmailValue<T>;
};

const buildNormalizedLocalizedSubjectTemplates = (
  key: EmailSubjectKey,
): LocalizedEmailValue<string> => {
  return buildLocalizedValuesForSupportedLanguages((language) =>
    EMAIL_SUBJECTS_TRANSLATIONS[key][language].replace(
      /{{\s*([^{}]+?)\s*}}/g,
      (_match, token: string) => `{{ ${snakeCase(token)} }}`,
    ),
  );
};

const buildSameLocalizedSubjectTemplates = (value: string): LocalizedEmailValue<string> =>
  buildLocalizedValuesForSupportedLanguages(() => value);

const defineEmailTemplateVariable = (
  key: string,
  label: string,
  type: EmailTemplateVariableDefinition["type"],
  sampleValue: EmailTemplateVariableDefinition["sampleValue"],
  options: Pick<EmailTemplateVariableDefinition, "required"> = {},
): EmailTemplateVariableDefinition => ({ key, label, type, sampleValue, ...options });

const createParagraphNode = (text: string) => ({
  type: "paragraph" as const,
  content: text ? [{ type: "text" as const, text }] : undefined,
});

const documentFromContent = (content: EmailContent, buttonUrl: string): EmailTemplateDocument => ({
  type: "doc",
  content: [
    { type: EMAIL_TEMPLATE_BLOCK_TYPES.HEADER, attrs: { source: "tenant_branding" } },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.HEADING,
      content: [createParagraphNode(content.heading)],
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.TEXT,
      content: content.paragraphs.map(createParagraphNode),
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.BUTTON,
      attrs: { label: content.buttonText, url: buttonUrl },
    },
    {
      type: EMAIL_TEMPLATE_BLOCK_TYPES.FOOTER,
      attrs: { text: "Powered by {{ company_name }}" },
    },
  ],
});

const createDefinition = ({
  event,
  name,
  description,
  sourceTemplate,
  subject,
  variables,
  getContent,
  buttonUrl,
}: CreateEmailTemplateDefinitionInput): EmailTemplateDefinition => ({
  event,
  name,
  description,
  sourceTemplate,
  defaultLanguage: SUPPORTED_LANGUAGES.EN,
  subjects: subject,
  variables,
  defaultDocuments: buildLocalizedValuesForSupportedLanguages((language) =>
    getContentDocument(getContent(language), buttonUrl),
  ),
});

const getContentDocument = (content: EmailContent, buttonUrl: string) =>
  documentFromContent(content, buttonUrl);

export const EMAIL_TEMPLATE_DEFINITIONS = [
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.WELCOME,
    name: "Welcome",
    description: "Sent when a learner's account is created.",
    sourceTemplate: "WelcomeEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("welcomeEmail"),
    variables: [
      defineEmailTemplateVariable(
        "courses_link",
        "Courses link",
        "url",
        "https://example.com/courses",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) => getWelcomeEmailTranslations(language),
    buttonUrl: "{{ courses_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY,
    name: "Password recovery",
    description: "Sent when a learner requests a password reset.",
    sourceTemplate: "PasswordRecoveryEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("passwordRecoveryEmail"),
    variables: [
      defineEmailTemplateVariable("name", "Name", "text", "Alex", { required: true }),
      defineEmailTemplateVariable("reset_link", "Reset link", "url", "https://example.com/reset", {
        required: true,
      }),
    ],
    getContent: (language) => getPasswordRecoveryEmailTranslations(language, "{{ name }}"),
    buttonUrl: "{{ reset_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.PASSWORD_REMINDER,
    name: "Password creation reminder",
    description: "Sent when a user needs to finish creating a password.",
    sourceTemplate: "CreatePasswordReminderEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("passwordReminderEmail"),
    variables: [
      defineEmailTemplateVariable(
        "create_password_link",
        "Create password link",
        "url",
        "https://example.com/password",
        { required: true },
      ),
    ],
    getContent: (language) => getCreatePasswordReminderEmailTranslations(language),
    buttonUrl: "{{ create_password_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_INVITE,
    name: "User invitation",
    description: "Sent when a user is invited to the platform.",
    sourceTemplate: "UserInviteEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userInviteEmail"),
    variables: [
      defineEmailTemplateVariable("invited_by_user_name", "Inviting user name", "text", "Jordan", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "create_password_link",
        "Create password link",
        "url",
        "https://example.com/password",
        { required: true },
      ),
    ],
    getContent: (language) =>
      getUserInviteEmailTranslations(language, "{{ invited_by_user_name }}"),
    buttonUrl: "{{ create_password_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_FIRST_LOGIN,
    name: "First login",
    description: "Sent after a learner's first successful login.",
    sourceTemplate: "UserFirstLoginEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userFirstLoginEmail"),
    variables: [
      defineEmailTemplateVariable("name", "Name", "text", "Alex", { required: true }),
      defineEmailTemplateVariable(
        "courses_url",
        "Courses link",
        "url",
        "https://example.com/courses",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) => getUserFirstLoginEmailTranslations(language, "{{ name }}"),
    buttonUrl: "{{ courses_url }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE,
    name: "Course assignment",
    description: "Sent when a learner is assigned to a course.",
    sourceTemplate: "UserAssignedToCourseEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userCourseAssignmentEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable(
        "formatted_course_due_date",
        "Formatted course due date",
        "date",
        "30 September 2026",
      ),
    ],
    getContent: (language) =>
      getUserAssignedToCourseEmailTranslations(
        language,
        "{{ course_name }}",
        "{{ formatted_course_due_date }}",
      ),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY,
    name: "Short inactivity reminder",
    description: "Sent when a learner has recently stopped progressing.",
    sourceTemplate: "UserShortInactivityEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userShortInactivityEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials"),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) =>
      getUserShortInactivityEmailTranslations(language, "{{ course_name }}"),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_LONG_INACTIVITY,
    name: "Long inactivity reminder",
    description: "Sent when a learner has been inactive for a longer period.",
    sourceTemplate: "UserLongInactivityEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userLongInactivityEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials"),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) => getUserLongInactivityEmailTranslations(language, "{{ course_name }}"),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_FINISHED_CHAPTER,
    name: "Chapter completion",
    description: "Sent when a learner completes a chapter.",
    sourceTemplate: "UserFinishedChapterEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userChapterFinishedEmail"),
    variables: [
      defineEmailTemplateVariable(
        "chapter_name",
        "Chapter name",
        "text",
        "Difficult conversations",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) =>
      getUserFinishedChapterEmailTranslations(language, "{{ chapter_name }}", "{{ course_name }}"),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_FINISHED_COURSE,
    name: "Course completion",
    description: "Sent when a learner completes a course.",
    sourceTemplate: "UserFinishedCourseEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("userCourseFinishedEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "button_link",
        "Action link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable("has_certificate", "Has certificate", "boolean", true, {
        required: true,
      }),
    ],
    getContent: (language) =>
      getUserFinishedCourseEmailTranslations(language, "{{ course_name }}", true),
    buttonUrl: "{{ button_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRATION_WARNING,
    name: "Certificate expiration warning",
    description: "Sent before a learner's certificate expires.",
    sourceTemplate: "CertificateExpirationWarningEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("certificateExpirationWarningEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable("expires_at", "Expiration date", "date", "30 September 2026", {
        required: true,
      }),
    ],
    getContent: (language) =>
      getCertificateExpirationWarningEmailTranslations(
        language,
        "{{ course_name }}",
        "{{ expires_at }}",
      ),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRED,
    name: "Certificate expired",
    description: "Sent when a learner's certificate expires or is reset.",
    sourceTemplate: "CertificateExpiredEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("certificateExpiredEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable(
        "reason",
        "Archive reason",
        "text",
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
        {
          required: true,
        },
      ),
    ],
    getContent: (language) =>
      getCertificateExpiredEmailTranslations(
        language,
        "{{ course_name }}",
        CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET,
      ),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_NEW_USER,
    name: "New user notification",
    description: "Sent to administrators when a new user registers.",
    sourceTemplate: "NewUserEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("adminNewUserEmail"),
    variables: [
      defineEmailTemplateVariable("user_name", "User name", "text", "Alex", { required: true }),
      defineEmailTemplateVariable(
        "profile_link",
        "Profile link",
        "url",
        "https://example.com/users/alex",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) => getNewUserEmailTranslations(language, "{{ user_name }}"),
    buttonUrl: "{{ profile_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_FINISHED_COURSE,
    name: "Admin course completion notification",
    description: "Sent to administrators when a learner completes a course.",
    sourceTemplate: "FinishedCourseEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("adminCourseFinishedEmail"),
    variables: [
      defineEmailTemplateVariable("user_name", "User name", "text", "Alex", { required: true }),
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "progress_link",
        "Progress link",
        "url",
        "https://example.com/progress",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) =>
      getFinishedCourseEmailTranslations(language, "{{ user_name }}", "{{ course_name }}"),
    buttonUrl: "{{ progress_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_OVERDUE_COURSES,
    name: "Overdue courses notification",
    description: "Sent to administrators about learners with overdue courses.",
    sourceTemplate: "OverdueCoursesEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("adminOverdueCoursesEmail"),
    variables: [
      defineEmailTemplateVariable(
        "courses",
        "Overdue courses",
        "collection",
        [
          {
            courseTitle: "{{ course_name }}",
            groups: [
              {
                groupName: "{{ group_name }}",
                dueDate: "{{ due_date }}",
                students: [{ name: "{{ user_name }}", email: "{{ email }}" }],
              },
            ],
          },
        ],
        { required: true },
      ),
      defineEmailTemplateVariable(
        "courses_link",
        "Courses link",
        "url",
        "https://example.com/courses",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) =>
      getOverdueCoursesEmailTranslations(language, [
        {
          courseTitle: "{{ course_name }}",
          groups: [
            {
              groupName: "{{ group_name }}",
              dueDate: "{{ due_date }}",
              students: [{ name: "{{ user_name }}", email: "{{ email }}" }],
            },
          ],
        },
      ]),
    buttonUrl: "{{ courses_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.COURSE_DUE_DATE_REMINDER,
    name: "Course due-date reminder",
    description: "Sent when a course deadline is approaching.",
    sourceTemplate: "CourseDueDateReminderEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("courseDueDateReminderEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable("due_date", "Due date", "date", "30 September 2026", {
        required: true,
      }),
      defineEmailTemplateVariable("days_before_due_date", "Days before due date", "number", 3, {
        required: true,
      }),
    ],
    getContent: (language) =>
      getCourseDueDateReminderEmailTranslations(language, "{{ course_name }}", "{{ due_date }}", 3),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.MAGIC_LINK,
    name: "Magic link",
    description: "Sent when a user requests a passwordless login link.",
    sourceTemplate: "MagicLinkEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("magicLinkEmail"),
    variables: [
      defineEmailTemplateVariable("magic_link", "Magic link", "url", "https://example.com/magic", {
        required: true,
      }),
    ],
    getContent: (language) => getMagicLinkEmailTranslations(language),
    buttonUrl: "{{ magic_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.COURSE_CHAT_MENTION,
    name: "Course chat mention",
    description: "Sent when a learner is mentioned in course chat.",
    sourceTemplate: "CourseChatMentionEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("courseChatMentionEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "message",
        "Message",
        "text",
        "You were mentioned in a discussion.",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable(
        "course_link",
        "Course link",
        "url",
        "https://example.com/courses/leadership",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) => ({
      heading: "{{ course_name }}",
      paragraphs: ["{{ message }}"],
      buttonText: getLiveTrainingEmailButtonText(language),
    }),
    buttonUrl: "{{ course_link }}",
  }),
  createDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ANNOUNCEMENT,
    name: "Announcement",
    description: "Sent when an announcement is delivered by email.",
    sourceTemplate: "AnnouncementEmail",
    subject: buildSameLocalizedSubjectTemplates("{{ title }}"),
    variables: [
      defineEmailTemplateVariable("title", "Title", "text", "Important update", { required: true }),
      defineEmailTemplateVariable(
        "content",
        "Content",
        "text",
        "Here is an important update for your organization.",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable(
        "button_link",
        "Announcement link",
        "url",
        "https://example.com/notifications",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) =>
      getAnnouncementEmailTranslations(language, "{{ title }}", "{{ content }}"),
    buttonUrl: "{{ button_link }}",
  }),
  ...(["started", "reminder", "ended"] as const).map((kind) =>
    createDefinition({
      event:
        EMAIL_TEMPLATE_EVENTS[
          `LIVE_TRAINING_${kind.toUpperCase()}` as
            | "LIVE_TRAINING_STARTED"
            | "LIVE_TRAINING_REMINDER"
            | "LIVE_TRAINING_ENDED"
        ],
      name: `Live training ${kind}`,
      description: `Sent when a live training is ${kind}.`,
      sourceTemplate: `LiveTraining${kind.charAt(0).toUpperCase()}${kind.slice(1)}Email`,
      subject: buildSameLocalizedSubjectTemplates("{{ title }}"),
      variables: [
        defineEmailTemplateVariable("title", "Title", "text", "Live training update", {
          required: true,
        }),
        defineEmailTemplateVariable(
          "content",
          "Content",
          "text",
          "Your live training has an update.",
          {
            required: true,
          },
        ),
        defineEmailTemplateVariable(
          "live_training_link",
          "Live training link",
          "url",
          "https://example.com/live-training",
          { required: true },
        ),
      ],
      getContent: (language) => ({
        heading: "{{ title }}",
        paragraphs: ["{{ content }}"],
        buttonText: getLiveTrainingEmailButtonText(language),
      }),
      buttonUrl: "{{ live_training_link }}",
    }),
  ),
] as const;

export const EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT = Object.fromEntries(
  EMAIL_TEMPLATE_DEFINITIONS.map((definition) => [definition.event, definition]),
) as Record<EmailTemplateEvent, EmailTemplateDefinition>;

export const getEmailTemplateDefinition = (event: EmailTemplateEvent): EmailTemplateDefinition => {
  return EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[event];
};
