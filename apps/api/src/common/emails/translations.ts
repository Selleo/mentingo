import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

export const EMAIL_SUBJECTS_TRANSLATIONS = {
  welcomeEmail: {
    en: "Welcome to our platform!",
    pl: "Witamy na naszej platformie!",
  },
  passwordRecoveryEmail: {
    en: "Password recovery",
    pl: "Odzyskiwanie hasła",
  },
  passwordReminderEmail: {
    en: "Account creation reminder",
    pl: "Przypomnienie o utworzeniu konta",
  },
  userInviteEmail: {
    en: "You're invited to the platform!",
    pl: "Zapraszamy na platformę!",
  },
  userFirstLoginEmail: {
    en: "First login!",
    pl: "Pierwsze logowanie!",
  },
  userCourseAssignmentEmail: {
    en: "New course - {{courseName}}",
    pl: "Nowy kurs - {{courseName}}",
  },
  userShortInactivityEmail: {
    en: "Continue your course - {{courseName}}",
    pl: "Kontynuuj kurs - {{courseName}}",
  },
  userLongInactivityEmail: {
    en: "Come back to your courses",
    pl: "Wróć do swoich kursów",
  },
  userChapterFinishedEmail: {
    en: "Module completed - {{chapterName}}",
    pl: "Ukończono moduł - {{chapterName}}",
  },
  userCourseFinishedEmail: {
    en: "Course completed - {{courseName}}",
    pl: "Ukończono kurs - {{courseName}}",
  },
  adminNewUserEmail: {
    en: "A new user has registered on your platform",
    pl: "Nowy użytkownik zarejestrował się na Twojej platformie",
  },
  adminCourseFinishedEmail: {
    en: "A user has completed a course on your platform",
    pl: "Użytkownik ukończył kurs na Twojej platformie",
  },
} as const;

export type EmailSubjectKey = keyof typeof EMAIL_SUBJECTS_TRANSLATIONS;

export const getEmailSubject = (
  key: EmailSubjectKey,
  language: SupportedLanguages,
  replacements: Record<string, string> = {},
) => {
  const translations = EMAIL_SUBJECTS_TRANSLATIONS[key];
  const template = translations[language] ?? translations[SUPPORTED_LANGUAGES.EN];

  return Object.entries(replacements).reduce((result, [token, value]) => {
    return result.replace(new RegExp(`{{${token}}}`, "g"), value);
  }, template);
};
