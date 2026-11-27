import { CERTIFICATE_ARCHIVE_REASONS } from "@repo/shared";

import { EMAIL_TEMPLATE_NAMES } from "./template-registry.constants";

import { getAnnouncementEmailTranslations } from "./translations/announcementEmail";
import { getCertificateExpirationWarningEmailTranslations } from "./translations/certificateExpirationWarning";
import { getCertificateExpiredEmailTranslations } from "./translations/certificateExpired";
import { getCourseDueDateReminderEmailTranslations } from "./translations/courseDueDateReminder";
import { getCreatePasswordReminderEmailTranslations } from "./translations/createPasswordReminder";
import {
  getDiscussionReplyEmailTranslations,
  getForumMentionEmailTranslations,
  getMentionUnsubscribeEmailLinks,
  getReplyUnsubscribeEmailLinks,
} from "./translations/discussions";
import { getFinishedCourseEmailTranslations } from "./translations/finishedCourse";
import { getLiveTrainingEmailButtonText } from "./translations/liveTrainingEmail";
import { getMagicLinkEmailTranslations } from "./translations/magicLink";
import { getNewUserEmailTranslations } from "./translations/newUser";
import {
  getCourseDueDatesAtRiskEmailTranslations,
  getOverdueCoursesEmailTranslations,
} from "./translations/dueDateCourses";
import { getPasswordRecoveryEmailTranslations } from "./translations/passwordRecovery";
import {
  getQuizAttemptGradedEmailTranslations,
  getQuizGradingDigestEmailTranslations,
} from "./translations/quizGrading";
import { getUserAssignedToCourseEmailTranslations } from "./translations/userAssignedToCourse";
import { getUserFinishedChapterEmailTranslations } from "./translations/userFinishedChapter";
import { getUserFinishedCourseEmailTranslations } from "./translations/userFinishedCourse";
import { getUserFirstLoginEmailTranslations } from "./translations/userFirstLogin";
import { getUserInviteEmailTranslations } from "./translations/userInvite";
import { getUserLongInactivityEmailTranslations } from "./translations/userLongInactivity";
import { getTenantUserCapacityEmailTranslations } from "./translations/tenantUserCapacity";
import { getContentMarketplaceCourseUpdateEmailTranslations } from "./translations/contentMarketplaceCourseUpdate";
import { getUserShortInactivityEmailTranslations } from "./translations/userShortInactivity";
import { getWelcomeEmailTranslations } from "./translations/welcome";

import {
  EMAIL_TEMPLATE_EVENTS,
  type EmailTemplateDefinition,
  type EmailTemplateEvent,
  type EmailTemplateVariableDefinition,
} from "./template-registry.types";
import {
  buildNormalizedLocalizedSubjectTemplates,
  buildSameLocalizedSubjectTemplates,
  createEmailTemplateDefinition,
  defineEmailTemplateVariable,
} from "./utils/templateRegistry";

export const EMAIL_TEMPLATE_SYSTEM_VARIABLES: readonly EmailTemplateVariableDefinition[] = [
  defineEmailTemplateVariable("company_name", "Company name", "text", "Mentingo", {
    required: true,
  }),
];

export const EMAIL_TEMPLATE_DEFINITIONS = [
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.WELCOME,
    name: EMAIL_TEMPLATE_NAMES.WELCOME,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY,
    name: EMAIL_TEMPLATE_NAMES.PASSWORD_RECOVERY,
    description: "Sent when a learner requests a password reset.",
    sourceTemplate: "PasswordRecoveryEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("passwordRecoveryEmail"),
    variables: [
      defineEmailTemplateVariable("name", "Name", "text", "Alex", { required: true }),
      defineEmailTemplateVariable("reset_link", "Reset link", "url", "https://example.com/reset", {
        required: true,
        requiredInTemplate: true,
      }),
    ],
    getContent: (language) => getPasswordRecoveryEmailTranslations(language, "{{ name }}"),
    buttonUrl: "{{ reset_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.PASSWORD_REMINDER,
    name: EMAIL_TEMPLATE_NAMES.PASSWORD_REMINDER,
    description: "Sent when a user needs to finish creating a password.",
    sourceTemplate: "CreatePasswordReminderEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("passwordReminderEmail"),
    variables: [
      defineEmailTemplateVariable(
        "create_password_link",
        "Create password link",
        "url",
        "https://example.com/password",
        { required: true, requiredInTemplate: true },
      ),
    ],
    getContent: (language) => getCreatePasswordReminderEmailTranslations(language),
    buttonUrl: "{{ create_password_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_INVITE,
    name: EMAIL_TEMPLATE_NAMES.USER_INVITE,
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
        { required: true, requiredInTemplate: true },
      ),
    ],
    getContent: (language) =>
      getUserInviteEmailTranslations(language, "{{ invited_by_user_name }}"),
    buttonUrl: "{{ create_password_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_FIRST_LOGIN,
    name: EMAIL_TEMPLATE_NAMES.USER_FIRST_LOGIN,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE,
    name: EMAIL_TEMPLATE_NAMES.USER_ASSIGNED_TO_COURSE,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_SHORT_INACTIVITY,
    name: EMAIL_TEMPLATE_NAMES.USER_SHORT_INACTIVITY,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_LONG_INACTIVITY,
    name: EMAIL_TEMPLATE_NAMES.USER_LONG_INACTIVITY,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_FINISHED_CHAPTER,
    name: EMAIL_TEMPLATE_NAMES.USER_FINISHED_CHAPTER,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.USER_FINISHED_COURSE,
    name: EMAIL_TEMPLATE_NAMES.USER_FINISHED_COURSE,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRATION_WARNING,
    name: EMAIL_TEMPLATE_NAMES.CERTIFICATE_EXPIRATION_WARNING,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRED,
    name: EMAIL_TEMPLATE_NAMES.CERTIFICATE_EXPIRED,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_NEW_USER,
    name: EMAIL_TEMPLATE_NAMES.ADMIN_NEW_USER,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_FINISHED_COURSE,
    name: EMAIL_TEMPLATE_NAMES.ADMIN_FINISHED_COURSE,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_OVERDUE_COURSES,
    name: EMAIL_TEMPLATE_NAMES.ADMIN_OVERDUE_COURSES,
    description: "Sent to administrators about learners with overdue courses.",
    sourceTemplate: "OverdueCoursesEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("adminOverdueCoursesEmail"),
    variables: [
      defineEmailTemplateVariable(
        "courses",
        "Overdue courses (up to two named, then a count)",
        "collection",
        [
          { courseTitle: "Leadership essentials", learnersCount: 12 },
          { courseTitle: "Phishing basics", learnersCount: 8 },
          { courseTitle: "Data privacy", learnersCount: 3 },
          { courseTitle: "Remote work", learnersCount: 2 },
        ],
        { required: true },
      ),
      defineEmailTemplateVariable(
        "courses_link",
        "Report link",
        "url",
        "https://example.com/reports",
        {
          required: true,
        },
      ),
    ],
    getContent: (language) => getOverdueCoursesEmailTranslations(language, "{{ courses }}"),
    buttonUrl: "{{ courses_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ADMIN_COURSE_DUE_DATES_AT_RISK,
    name: EMAIL_TEMPLATE_NAMES.ADMIN_COURSE_DUE_DATES_AT_RISK,
    description:
      "Sent to administrators once per due date, five days before it, when learners have not completed those courses.",
    sourceTemplate: "CourseDueDatesAtRiskEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("adminCourseDueDatesAtRiskEmail"),
    variables: [
      defineEmailTemplateVariable(
        "at_risk_courses_summary",
        "Courses with an approaching due date (up to two named, then a count)",
        "text",
        "Leadership essentials, Phishing basics and 2 more",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "at_risk_learners_count",
        "Number of learners who have not completed the courses",
        "number",
        50,
      ),
      defineEmailTemplateVariable(
        "at_risk_courses_count",
        "Number of courses with an approaching due date",
        "number",
        4,
      ),
      defineEmailTemplateVariable(
        "report_link",
        "Report link",
        "url",
        "https://example.com/reports",
        { required: true },
      ),
    ],
    getContent: (language) =>
      getCourseDueDatesAtRiskEmailTranslations(language, "{{ at_risk_courses_summary }}"),
    buttonUrl: "{{ report_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.COURSE_DUE_DATE_REMINDER,
    name: EMAIL_TEMPLATE_NAMES.COURSE_DUE_DATE_REMINDER,
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
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.MAGIC_LINK,
    name: EMAIL_TEMPLATE_NAMES.MAGIC_LINK,
    description: "Sent when a user requests a passwordless login link.",
    sourceTemplate: "MagicLinkEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("magicLinkEmail"),
    variables: [
      defineEmailTemplateVariable("magic_link", "Magic link", "url", "https://example.com/magic", {
        required: true,
        requiredInTemplate: true,
      }),
    ],
    getContent: (language) => getMagicLinkEmailTranslations(language),
    buttonUrl: "{{ magic_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.COURSE_CHAT_MENTION,
    name: EMAIL_TEMPLATE_NAMES.COURSE_CHAT_MENTION,
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
      defineEmailTemplateVariable(
        "unsubscribe_link",
        "Unsubscribe link",
        "url",
        "https://example.com/notifications/unsubscribe",
        { required: true },
      ),
    ],
    getContent: (language) => ({
      heading: "{{ course_name }}",
      paragraphs: ["{{ message }}"],
      buttonText: getLiveTrainingEmailButtonText(language),
      links: getMentionUnsubscribeEmailLinks(language, "{{ unsubscribe_link }}"),
    }),
    buttonUrl: "{{ course_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.QUIZ_ATTEMPT_GRADED,
    name: EMAIL_TEMPLATE_NAMES.QUIZ_ATTEMPT_GRADED,
    description: "Sent when a reviewer grades a learner's quiz attempt.",
    sourceTemplate: "QuizAttemptGradedEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("quizAttemptGradedEmail"),
    variables: [
      defineEmailTemplateVariable("course_name", "Course name", "text", "Leadership essentials", {
        required: true,
      }),
      defineEmailTemplateVariable("lesson_name", "Lesson name", "text", "Final quiz", {
        required: true,
      }),
      defineEmailTemplateVariable("score", "Score", "number", 80, { required: true }),
      defineEmailTemplateVariable(
        "lesson_link",
        "Lesson link",
        "url",
        "https://example.com/course/leadership/lesson/final-quiz",
        { required: true },
      ),
    ],
    getContent: (language) =>
      getQuizAttemptGradedEmailTranslations(
        language,
        "{{ lesson_name }}",
        "{{ course_name }}",
        "{{ score }}",
      ),
    buttonUrl: "{{ lesson_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.QUIZ_GRADING_DIGEST,
    name: EMAIL_TEMPLATE_NAMES.QUIZ_GRADING_DIGEST,
    description: "Sent daily to reviewers when new quiz answers are waiting for grading.",
    sourceTemplate: "QuizGradingDigestEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("quizGradingDigestEmail"),
    variables: [
      defineEmailTemplateVariable("new_answers_count", "New answers", "number", 3, {
        required: true,
      }),
      defineEmailTemplateVariable("pending_answers_count", "Answers waiting", "number", 7, {
        required: true,
      }),
      defineEmailTemplateVariable(
        "grading_queue_link",
        "Grading queue link",
        "url",
        "https://example.com/quiz-grading",
        { required: true },
      ),
    ],
    getContent: (language) =>
      getQuizGradingDigestEmailTranslations(
        language,
        "{{ new_answers_count }}",
        "{{ pending_answers_count }}",
      ),
    buttonUrl: "{{ grading_queue_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.FORUM_MENTION,
    name: EMAIL_TEMPLATE_NAMES.FORUM_MENTION,
    description: "Sent when a user is mentioned in a forum topic.",
    sourceTemplate: "ForumMentionEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("forumMentionEmail"),
    variables: [
      defineEmailTemplateVariable("authorFullName", "Author full name", "text", "Jane Doe", {
        required: true,
      }),
      defineEmailTemplateVariable("topic_title", "Topic title", "text", "Onboarding tips", {
        required: true,
      }),
      defineEmailTemplateVariable(
        "message",
        "Message",
        "text",
        "You were mentioned in a discussion.",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "topic_link",
        "Topic link",
        "url",
        "https://example.com/forum/topics/onboarding-tips",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "unsubscribe_link",
        "Unsubscribe link",
        "url",
        "https://example.com/notifications/unsubscribe",
        { required: true },
      ),
    ],
    getContent: (language) => ({
      ...getForumMentionEmailTranslations(
        language,
        "{{ authorFullName }}",
        "{{ topic_title }}",
        "{{ message }}",
      ),
      links: getMentionUnsubscribeEmailLinks(language, "{{ unsubscribe_link }}"),
    }),
    buttonUrl: "{{ topic_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.DISCUSSION_REPLY,
    name: EMAIL_TEMPLATE_NAMES.DISCUSSION_REPLY,
    description:
      "Sent to the participants of a course discussion thread or a forum topic about new replies, grouped into one email.",
    sourceTemplate: "DiscussionReplyEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("discussionReplyEmail"),
    variables: [
      defineEmailTemplateVariable(
        "discussion_name",
        "Discussion name",
        "text",
        "Leadership essentials",
        { required: true },
      ),
      defineEmailTemplateVariable("reply_count", "New replies", "number", 3, { required: true }),
      defineEmailTemplateVariable(
        "reply_authors",
        "Reply authors",
        "text",
        "Jane Doe, John Smith",
        {
          required: true,
        },
      ),
      defineEmailTemplateVariable(
        "latest_reply",
        "Latest reply",
        "text",
        "Thanks, that solved it for me.",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "discussion_link",
        "Discussion link",
        "url",
        "https://example.com/course/leadership?tab=Discussion",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "unfollow_link",
        "Stop following link",
        "url",
        "https://example.com/notifications/unsubscribe",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "unsubscribe_link",
        "Unsubscribe link",
        "url",
        "https://example.com/notifications/unsubscribe",
        { required: true },
      ),
    ],
    getContent: (language) => ({
      ...getDiscussionReplyEmailTranslations(
        language,
        "{{ discussion_name }}",
        "{{ reply_count }}",
        "{{ reply_authors }}",
        "{{ latest_reply }}",
      ),
      links: getReplyUnsubscribeEmailLinks(
        language,
        "{{ unfollow_link }}",
        "{{ unsubscribe_link }}",
      ),
    }),
    buttonUrl: "{{ discussion_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.ANNOUNCEMENT,
    name: EMAIL_TEMPLATE_NAMES.ANNOUNCEMENT,
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
  ...(["started", "reminder", "ended"] as const).map((kind) => {
    const eventKey = `LIVE_TRAINING_${kind.toUpperCase()}` as
      | "LIVE_TRAINING_STARTED"
      | "LIVE_TRAINING_REMINDER"
      | "LIVE_TRAINING_ENDED";
    const event = EMAIL_TEMPLATE_EVENTS[eventKey];

    return createEmailTemplateDefinition({
      event,
      name: EMAIL_TEMPLATE_NAMES[eventKey],
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
    });
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.TENANT_USER_CAPACITY,
    name: EMAIL_TEMPLATE_NAMES.TENANT_USER_CAPACITY,
    description:
      "Sent to administrators when the organization approaches its user limit, reaches it, or runs out of user slots.",
    sourceTemplate: "TenantUserCapacityEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("tenantUserCapacityEmail"),
    variables: [
      defineEmailTemplateVariable(
        "capacity_title",
        "Capacity alert title",
        "text",
        "Your organization has reached its user limit",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "capacity_message",
        "Capacity alert message",
        "text",
        "200 users are active and your plan includes 200. You can add up to 220 users in total.",
        { required: true },
      ),
      defineEmailTemplateVariable("active_users_count", "Active users", "number", 200),
      defineEmailTemplateVariable("max_users", "Users in plan", "number", 200),
      defineEmailTemplateVariable("allowed_users_count", "Allowed users", "number", 220),
      defineEmailTemplateVariable(
        "users_link",
        "Users page link",
        "url",
        "https://example.com/admin/users",
        { required: true },
      ),
    ],
    getContent: (language) =>
      getTenantUserCapacityEmailTranslations(
        language,
        "{{ capacity_title }}",
        "{{ capacity_message }}",
      ),
    buttonUrl: "{{ users_link }}",
  }),
  createEmailTemplateDefinition({
    event: EMAIL_TEMPLATE_EVENTS.CONTENT_MARKETPLACE_COURSE_UPDATE,
    name: EMAIL_TEMPLATE_NAMES.CONTENT_MARKETPLACE_COURSE_UPDATE,
    description:
      "Sent to administrators once per daily check, listing the courses added from the content marketplace that have a newer version.",
    sourceTemplate: "ContentMarketplaceCourseUpdateEmail",
    subject: buildNormalizedLocalizedSubjectTemplates("contentMarketplaceCourseUpdateEmail"),
    variables: [
      defineEmailTemplateVariable(
        "courses_with_new_version",
        "Courses with a new version (up to two named, then a count)",
        "text",
        "Leadership essentials, Phishing basics and 3 more",
        { required: true },
      ),
      defineEmailTemplateVariable(
        "all_courses_with_new_version",
        "All courses with a new version",
        "text",
        "Cyber hygiene, Data privacy, Leadership essentials, Phishing basics and Remote work",
      ),
      defineEmailTemplateVariable(
        "courses_with_new_version_count",
        "Number of courses with a new version",
        "number",
        5,
      ),
      defineEmailTemplateVariable(
        "marketplace_link",
        "Content marketplace link",
        "url",
        "https://example.com/content-marketplace",
        { required: true },
      ),
    ],
    getContent: (language) =>
      getContentMarketplaceCourseUpdateEmailTranslations(
        language,
        "{{ courses_with_new_version }}",
      ),
    buttonUrl: "{{ marketplace_link }}",
  }),
] as const;

export const EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT = Object.fromEntries(
  EMAIL_TEMPLATE_DEFINITIONS.map((definition) => [definition.event, definition]),
) as Record<EmailTemplateEvent, EmailTemplateDefinition>;

export const getEmailTemplateDefinition = (event: EmailTemplateEvent): EmailTemplateDefinition => {
  return EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[event];
};
