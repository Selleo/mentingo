import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";

export const EMAIL_SUBJECTS_TRANSLATIONS = {
  welcomeEmail: {
    en: "Welcome to our platform!",
    pl: "Witamy na naszej platformie!",
    de: "Willkommen auf unserer Plattform!",
    lt: "Sveiki atvykę į mūsų platformą!",
    cs: "Vítejte na naší platformě!",
  },
  passwordRecoveryEmail: {
    en: "Password recovery",
    pl: "Odzyskiwanie hasła",
    de: "Passwort-Wiederherstellung",
    lt: "Slaptažodžio atkūrimas",
    cs: "Obnovení hesla",
  },
  passwordReminderEmail: {
    en: "Account creation reminder",
    pl: "Przypomnienie o utworzeniu konta",
    de: "Erinnerung zur Kontoerstellung",
    lt: "Paskyros sukūrimo priminimas",
    cs: "Připomenutí vytvoření účtu",
  },
  userInviteEmail: {
    en: "You're invited to the platform!",
    pl: "Zapraszamy na platformę!",
    de: "Du bist auf die Plattform eingeladen!",
    lt: "Esi pakviestas į platformą!",
    cs: "Jsi pozván(a) na platformu!",
  },
  userFirstLoginEmail: {
    en: "First login!",
    pl: "Pierwsze logowanie!",
    de: "Erste Anmeldung!",
    lt: "Pirmasis prisijungimas!",
    cs: "První přihlášení!",
  },
  userCourseAssignmentEmail: {
    en: "New course - {{courseName}}",
    pl: "Nowy kurs - {{courseName}}",
    de: "Neuer Kurs - {{courseName}}",
    lt: "Naujas kursas - {{courseName}}",
    cs: "Nový kurz - {{courseName}}",
  },
  userShortInactivityEmail: {
    en: "Continue your course - {{courseName}}",
    pl: "Kontynuuj kurs - {{courseName}}",
    de: "Setze deinen Kurs fort - {{courseName}}",
    lt: "Tęsk savo kursą - {{courseName}}",
    cs: "Pokračuj ve svém kurzu - {{courseName}}",
  },
  userLongInactivityEmail: {
    en: "Come back to your courses",
    pl: "Wróć do swoich kursów",
    de: "Kehre zu deinen Kursen zurück",
    lt: "Sugrįžk prie savo kursų",
    cs: "Vrať se ke svým kurzům",
  },
  userChapterFinishedEmail: {
    en: "Module completed - {{chapterName}}",
    pl: "Ukończono moduł - {{chapterName}}",
    de: "Modul abgeschlossen - {{chapterName}}",
    lt: "Modulis baigtas - {{chapterName}}",
    cs: "Modul dokončen - {{chapterName}}",
  },
  userCourseFinishedEmail: {
    en: "Course completed - {{courseName}}",
    pl: "Ukończono kurs - {{courseName}}",
    de: "Kurs abgeschlossen - {{courseName}}",
    lt: "Kursas baigtas - {{courseName}}",
    cs: "Kurz dokončen - {{courseName}}",
  },
  adminNewUserEmail: {
    en: "A new user has registered on your platform",
    pl: "Nowy użytkownik zarejestrował się na Twojej platformie",
    de: "Ein neuer Benutzer hat sich auf deiner Plattform registriert",
    lt: "Naujas naudotojas užsiregistravo tavo platformoje",
    cs: "Na tvé platformě se zaregistroval nový uživatel",
  },
  adminCourseFinishedEmail: {
    en: "A user has completed a course on your platform",
    pl: "Użytkownik ukończył kurs na Twojej platformie",
    de: "Ein Benutzer hat einen Kurs auf deiner Plattform abgeschlossen",
    lt: "Naudotojas baigė kursą tavo platformoje",
    cs: "Uživatel dokončil kurz na tvé platformě",
  },
  magicLinkEmail: {
    en: "Login link",
    pl: "Link do logowania",
    de: "Anmeldelink",
    lt: "Prisijungimo nuoroda",
    cs: "Přihlašovací odkaz",
  },
  courseChatMentionEmail: {
    en: "You were mentioned in {{courseName}}",
    pl: "Oznaczono Cię w kursie {{courseName}}",
    de: "Du wurdest in {{courseName}} erwähnt",
    lt: "Buvote paminėti kurse {{courseName}}",
    cs: "Byl(a) jste zmíněn(a) v kurzu {{courseName}}",
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
