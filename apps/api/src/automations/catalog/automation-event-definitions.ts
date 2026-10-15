import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_FIELD_SENSITIVITIES,
  type AutomationEventDefinition,
} from "@repo/shared";

/** Stable event metadata is independent of email template publications. */
export const AUTOMATION_EVENT_DEFINITIONS: Omit<AutomationEventDefinition, "providedVariables">[] =
  [
    {
      kind: AUTOMATION_EVENT_KINDS.WELCOME,
      label: "Welcome",
      description: "Sent when a learner's account is created.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "courses_link",
          label: "Courses link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.PASSWORD_RECOVERY,
      label: "Password recovery",
      description: "Sent when a learner requests a password reset.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "name",
          label: "Name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Alex",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "reset_link",
          label: "Reset link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.invalid/account-action",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.PASSWORD_REMINDER,
      label: "Password creation reminder",
      description: "Sent when a user needs to finish creating a password.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "create_password_link",
          label: "Create password link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.invalid/account-action",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_INVITE,
      label: "User invitation",
      description: "Sent when a user is invited to the platform.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "invited_by_user_name",
          label: "Inviting user name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Jordan",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "create_password_link",
          label: "Create password link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.invalid/account-action",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_FIRST_LOGIN,
      label: "First login",
      description: "Sent after a learner's first successful login.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "name",
          label: "Name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Alex",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "courses_url",
          label: "Courses link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_ASSIGNED_TO_COURSE,
      label: "Course assignment",
      description: "Sent when a learner is assigned to a course.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "formatted_course_due_date",
          label: "Formatted course due date",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "30 September 2026",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_SHORT_INACTIVITY,
      label: "Short inactivity reminder",
      description: "Sent when a learner has recently stopped progressing.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_LONG_INACTIVITY,
      label: "Long inactivity reminder",
      description: "Sent when a learner has been inactive for a longer period.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_FINISHED_CHAPTER,
      label: "Chapter completion",
      description: "Sent when a learner completes a chapter.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "chapter_name",
          label: "Chapter name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Difficult conversations",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
      label: "Course completion",
      description: "Sent when a learner completes a course.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "button_link",
          label: "Action link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "has_certificate",
          label: "Has certificate",
          type: AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN,
          sampleValue: true,
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRATION_WARNING,
      label: "Certificate expiration warning",
      description: "Sent before a learner's certificate expires.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "expires_at",
          label: "Expiration date",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "30 September 2026",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRED,
      label: "Certificate expired",
      description: "Sent when a learner's certificate expires or is reset.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "reason",
          label: "Archive reason",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "manual_reset",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.ADMIN_NEW_USER,
      label: "New user notification",
      description: "Sent to administrators when a new user registers.",
      recipientPolicy:
        "Eligible administrators selected by the event producer, respecting personal notification preferences.",
      fields: [
        {
          key: "user_name",
          label: "User name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Alex",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "profile_link",
          label: "Profile link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/users/alex",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE,
      label: "Admin course completion notification",
      description: "Sent to administrators when a learner completes a course.",
      recipientPolicy:
        "Eligible administrators selected by the event producer, respecting personal notification preferences.",
      fields: [
        {
          key: "user_name",
          label: "User name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Alex",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "progress_link",
          label: "Progress link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/progress",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES,
      label: "Overdue courses notification",
      description: "Sent to administrators about learners with overdue courses.",
      recipientPolicy:
        "Eligible administrators selected by the event producer, respecting personal notification preferences.",
      fields: [
        {
          key: "overdue_courses_summary",
          label: "Overdue courses",
          type: AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING,
          sampleValue:
            "Some students did not finish their courses on time:\n\nCourse: Leadership essentials\n    Group: New managers\n    Due date: 2026-09-30\n    Students:\n    - Alex Morgan (alex@example.com)\n",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "courses_link",
          label: "Courses link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.COURSE_DUE_DATE_REMINDER,
      label: "Course due-date reminder",
      description: "Sent when a course deadline is approaching.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "due_date",
          label: "Due date",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "30 September 2026",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "days_before_due_date",
          label: "Days before due date",
          type: AUTOMATION_PLACEHOLDER_TYPES.NUMBER,
          sampleValue: 3,
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.MAGIC_LINK,
      label: "Magic link",
      description: "Sent when a user requests a passwordless login link.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "magic_link",
          label: "Magic link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.invalid/account-action",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ACCOUNT_ACTION_LINK,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.COURSE_CHAT_MENTION,
      label: "Course chat mention",
      description: "Sent when a learner is mentioned in course chat.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "course_name",
          label: "Course name",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Leadership essentials",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "message",
          label: "Message",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "You were mentioned in a discussion.",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "course_link",
          label: "Course link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/courses/leadership",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.ANNOUNCEMENT,
      label: "Announcement",
      description: "Sent when an announcement is delivered by email.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "title",
          label: "Title",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Important update",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "content",
          label: "Content",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Here is an important update for your organization.",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "button_link",
          label: "Announcement link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/notifications",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_STARTED,
      label: "Live training started",
      description: "Sent when a live training is started.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "title",
          label: "Title",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Live training update",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "content",
          label: "Content",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Your live training has an update.",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "live_training_link",
          label: "Live training link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/live-training",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_REMINDER,
      label: "Live training reminder",
      description: "Sent when a live training is reminder.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "title",
          label: "Title",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Live training update",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "content",
          label: "Content",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Your live training has an update.",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "live_training_link",
          label: "Live training link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/live-training",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
    {
      kind: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_ENDED,
      label: "Live training ended",
      description: "Sent when a live training is ended.",
      recipientPolicy:
        "Eligible recipients selected by the event producer. Account operations and in-app notifications remain independent.",
      fields: [
        {
          key: "title",
          label: "Title",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Live training update",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "content",
          label: "Content",
          type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
          sampleValue: "Your live training has an update.",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
        {
          key: "live_training_link",
          label: "Live training link",
          type: AUTOMATION_PLACEHOLDER_TYPES.URL,
          sampleValue: "https://example.com/live-training",
          sensitivity: AUTOMATION_FIELD_SENSITIVITIES.ORDINARY,
        },
      ],
    },
  ];
