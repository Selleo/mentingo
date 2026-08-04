export interface EmailTemplateDefinition {
  id: string;
  labelKey: string;
  placeholders: string[];
}

export const DEFAULT_EMAIL_TEMPLATE_ID = "default_email";

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    id: DEFAULT_EMAIL_TEMPLATE_ID,
    labelKey: "automationBuilder.editAction.templates.defaultEmail",
    placeholders: [],
  },
  {
    id: "user_invite",
    labelKey: "automationBuilder.editAction.templates.userInvite",
    placeholders: ["invitedByUserName", "createPasswordLink"],
  },
  {
    id: "welcome",
    labelKey: "automationBuilder.editAction.templates.welcome",
    placeholders: ["coursesLink"],
  },
  {
    id: "user_first_login",
    labelKey: "automationBuilder.editAction.templates.userFirstLogin",
    placeholders: ["name", "coursesUrl"],
  },
  {
    id: "user_assigned_to_course",
    labelKey: "automationBuilder.editAction.templates.userAssignedToCourse",
    placeholders: ["courseName", "courseLink", "formatedCourseDueDate"],
  },
  {
    id: "user_short_inactivity",
    labelKey: "automationBuilder.editAction.templates.userShortInactivity",
    placeholders: ["courseName", "courseLink"],
  },
  {
    id: "user_long_inactivity",
    labelKey: "automationBuilder.editAction.templates.userLongInactivity",
    placeholders: ["courseName", "courseLink"],
  },
  {
    id: "user_finished_chapter",
    labelKey: "automationBuilder.editAction.templates.userFinishedChapter",
    placeholders: ["chapterName", "courseName", "courseLink"],
  },
  {
    id: "user_finished_course",
    labelKey: "automationBuilder.editAction.templates.userFinishedCourse",
    placeholders: ["courseName", "buttonLink", "hasCertificate"],
  },
  {
    id: "create_password_reminder",
    labelKey: "automationBuilder.editAction.templates.createPasswordReminder",
    placeholders: ["createPasswordLink"],
  },
  {
    id: "certificate_expiration_warning",
    labelKey: "automationBuilder.editAction.templates.certificateExpirationWarning",
    placeholders: ["courseName", "courseLink", "expiresAt"],
  },
  {
    id: "certificate_expired",
    labelKey: "automationBuilder.editAction.templates.certificateExpired",
    placeholders: ["courseName", "courseLink"],
  },
  {
    id: "announcement",
    labelKey: "automationBuilder.editAction.templates.announcement",
    placeholders: ["title", "content", "buttonLink"],
  },
  {
    id: "course_due_date_reminder",
    labelKey: "automationBuilder.editAction.templates.courseDueDateReminder",
    placeholders: ["courseName", "courseLink", "dueDate", "daysBeforeDueDate"],
  },
  {
    id: "new_user",
    labelKey: "automationBuilder.editAction.templates.newUser",
    placeholders: ["userName", "profileLink"],
  },
  {
    id: "finished_course",
    labelKey: "automationBuilder.editAction.templates.finishedCourse",
    placeholders: ["userName", "courseName", "progressLink"],
  },
];
