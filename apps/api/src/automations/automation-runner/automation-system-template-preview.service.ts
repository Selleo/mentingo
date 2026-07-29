import { Injectable } from "@nestjs/common";
import {
  AnnouncementEmail,
  CertificateExpirationWarningEmail,
  CertificateExpiredEmail,
  CourseDueDateReminderEmail,
  CreatePasswordReminderEmail,
  FinishedCourseEmail,
  NewUserEmail,
  UserAssignedToCourseEmail,
  UserFinishedChapterEmail,
  UserFinishedCourseEmail,
  UserFirstLoginEmail,
  UserInviteEmail,
  UserLongInactivityEmail,
  UserShortInactivityEmail,
  WelcomeEmail,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { CORS_ORIGIN } from "src/auth/consts";

import type { SupportedLanguages } from "@repo/shared";

interface PreviewSampleData {
  userName: string;
  userFullName: string;
  invitedByName: string;
  courseName: string;
  chapterName: string;
  announcementTitle: string;
  announcementContent: string;
  dueDate: string;
  expiresAt: string;
  subjects: {
    userInvite: string;
    welcome: string;
    userFirstLogin: string;
    userAssignedToCourse: string;
    userShortInactivity: string;
    userLongInactivity: string;
    userFinishedChapter: string;
    userFinishedCourse: string;
    createPasswordReminder: string;
    certificateExpirationWarning: string;
    certificateExpired: string;
    announcement: string;
    courseDueDateReminder: string;
    newUser: string;
    finishedCourse: string;
  };
}

const SAMPLE_DATA: Record<SupportedLanguages, PreviewSampleData> = {
  pl: {
    userName: "Jan",
    userFullName: "Jan Kowalski",
    invitedByName: "Anna Nowak",
    courseName: "Szkolenie BHP 2025",
    chapterName: "Rozdział 1: Wprowadzenie",
    announcementTitle: "Nowe szkolenie dostępne",
    announcementContent: "Zapraszamy na nowe szkolenie z zakresu bezpieczeństwa pracy.",
    dueDate: "15.08.2025",
    expiresAt: "31.12.2025",
    subjects: {
      userInvite: "Zaproszenie do platformy",
      welcome: "Witaj na platformie",
      userFirstLogin: "Pierwsze logowanie",
      userAssignedToCourse: "Przypisanie do kursu",
      userShortInactivity: "Przypomnienie o kursie",
      userLongInactivity: "Dawno Cię nie było",
      userFinishedChapter: "Ukończono rozdział",
      userFinishedCourse: "Gratulacje! Kurs ukończony",
      createPasswordReminder: "Utwórz hasło",
      certificateExpirationWarning: "Certyfikat wygasa wkrótce",
      certificateExpired: "Certyfikat wygasł",
      announcement: "Nowe szkolenie dostępne",
      courseDueDateReminder: "Zbliża się termin kursu",
      newUser: "Nowy użytkownik zarejestrowany",
      finishedCourse: "Użytkownik ukończył kurs",
    },
  },
  en: {
    userName: "John",
    userFullName: "John Smith",
    invitedByName: "Jane Doe",
    courseName: "Health & Safety Training 2025",
    chapterName: "Chapter 1: Introduction",
    announcementTitle: "New training available",
    announcementContent: "We invite you to a new workplace safety training course.",
    dueDate: "08/15/2025",
    expiresAt: "12/31/2025",
    subjects: {
      userInvite: "Platform invitation",
      welcome: "Welcome to the platform",
      userFirstLogin: "First login",
      userAssignedToCourse: "Course assignment",
      userShortInactivity: "Course reminder",
      userLongInactivity: "We miss you",
      userFinishedChapter: "Chapter completed",
      userFinishedCourse: "Congratulations! Course completed",
      createPasswordReminder: "Create your password",
      certificateExpirationWarning: "Certificate expiring soon",
      certificateExpired: "Certificate expired",
      announcement: "New training available",
      courseDueDateReminder: "Course deadline approaching",
      newUser: "New user registered",
      finishedCourse: "User completed course",
    },
  },
  de: {
    userName: "Max",
    userFullName: "Max Mustermann",
    invitedByName: "Erika Musterfrau",
    courseName: "Arbeitssicherheit Schulung 2025",
    chapterName: "Kapitel 1: Einführung",
    announcementTitle: "Neue Schulung verfügbar",
    announcementContent: "Wir laden Sie zu einer neuen Schulung zur Arbeitssicherheit ein.",
    dueDate: "15.08.2025",
    expiresAt: "31.12.2025",
    subjects: {
      userInvite: "Plattform-Einladung",
      welcome: "Willkommen auf der Plattform",
      userFirstLogin: "Erste Anmeldung",
      userAssignedToCourse: "Kurszuweisung",
      userShortInactivity: "Kurs-Erinnerung",
      userLongInactivity: "Wir vermissen Sie",
      userFinishedChapter: "Kapitel abgeschlossen",
      userFinishedCourse: "Herzlichen Glückwunsch! Kurs abgeschlossen",
      createPasswordReminder: "Passwort erstellen",
      certificateExpirationWarning: "Zertifikat läuft bald ab",
      certificateExpired: "Zertifikat abgelaufen",
      announcement: "Neue Schulung verfügbar",
      courseDueDateReminder: "Kursfrist nähert sich",
      newUser: "Neuer Benutzer registriert",
      finishedCourse: "Benutzer hat Kurs abgeschlossen",
    },
  },
  lt: {
    userName: "Jonas",
    userFullName: "Jonas Jonaitis",
    invitedByName: "Ona Onaitė",
    courseName: "Darbo saugos mokymai 2025",
    chapterName: "1 skyrius: Įvadas",
    announcementTitle: "Nauji mokymai prieinami",
    announcementContent: "Kviečiame į naujus darbo saugos mokymus.",
    dueDate: "2025-08-15",
    expiresAt: "2025-12-31",
    subjects: {
      userInvite: "Kvietimas į platformą",
      welcome: "Sveiki atvykę į platformą",
      userFirstLogin: "Pirmas prisijungimas",
      userAssignedToCourse: "Priskirtas kursas",
      userShortInactivity: "Kurso priminimas",
      userLongInactivity: "Seniai jūsų nematėme",
      userFinishedChapter: "Skyrius baigtas",
      userFinishedCourse: "Sveikiname! Kursas baigtas",
      createPasswordReminder: "Sukurkite slaptažodį",
      certificateExpirationWarning: "Sertifikatas netrukus baigsis",
      certificateExpired: "Sertifikatas nebegalioja",
      announcement: "Nauji mokymai prieinami",
      courseDueDateReminder: "Artėja kurso terminas",
      newUser: "Naujas vartotojas užsiregistravo",
      finishedCourse: "Vartotojas baigė kursą",
    },
  },
  cs: {
    userName: "Jan",
    userFullName: "Jan Novák",
    invitedByName: "Eva Nováková",
    courseName: "Školení BOZP 2025",
    chapterName: "Kapitola 1: Úvod",
    announcementTitle: "Nové školení k dispozici",
    announcementContent: "Zveme vás na nové školení bezpečnosti práce.",
    dueDate: "15.08.2025",
    expiresAt: "31.12.2025",
    subjects: {
      userInvite: "Pozvánka na platformu",
      welcome: "Vítejte na platformě",
      userFirstLogin: "První přihlášení",
      userAssignedToCourse: "Přiřazení ke kurzu",
      userShortInactivity: "Připomínka kurzu",
      userLongInactivity: "Dlouho jsme vás neviděli",
      userFinishedChapter: "Kapitola dokončena",
      userFinishedCourse: "Gratulujeme! Kurz dokončen",
      createPasswordReminder: "Vytvořte si heslo",
      certificateExpirationWarning: "Certifikát brzy vyprší",
      certificateExpired: "Certifikát vypršel",
      announcement: "Nové školení k dispozici",
      courseDueDateReminder: "Blíží se termín kurzu",
      newUser: "Nový uživatel se zaregistroval",
      finishedCourse: "Uživatel dokončil kurz",
    },
  },
  es: {
    userName: "Juan",
    userFullName: "Juan García",
    invitedByName: "María López",
    courseName: "Formación en Seguridad Laboral 2025",
    chapterName: "Capítulo 1: Introducción",
    announcementTitle: "Nueva formación disponible",
    announcementContent: "Le invitamos a una nueva formación sobre seguridad laboral.",
    dueDate: "15/08/2025",
    expiresAt: "31/12/2025",
    subjects: {
      userInvite: "Invitación a la plataforma",
      welcome: "Bienvenido a la plataforma",
      userFirstLogin: "Primer inicio de sesión",
      userAssignedToCourse: "Asignación de curso",
      userShortInactivity: "Recordatorio de curso",
      userLongInactivity: "Te echamos de menos",
      userFinishedChapter: "Capítulo completado",
      userFinishedCourse: "¡Felicidades! Curso completado",
      createPasswordReminder: "Crea tu contraseña",
      certificateExpirationWarning: "El certificado expira pronto",
      certificateExpired: "Certificado expirado",
      announcement: "Nueva formación disponible",
      courseDueDateReminder: "Se acerca la fecha límite del curso",
      newUser: "Nuevo usuario registrado",
      finishedCourse: "El usuario completó el curso",
    },
  },
};

@Injectable()
export class AutomationSystemTemplatePreviewService {
  async renderPreview(
    templateId: string,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.PL,
  ): Promise<{ subject: string; html: string } | null> {
    const raw = await this.renderRawPreview(templateId, language);
    if (!raw) return null;

    return {
      subject: raw.subject,
      html: this.replaceCidReferences(raw.html),
    };
  }

  private getSampleData(language: SupportedLanguages): PreviewSampleData {
    return SAMPLE_DATA[language] ?? SAMPLE_DATA.en;
  }

  private async renderRawPreview(
    templateId: string,
    language: SupportedLanguages,
  ): Promise<{ subject: string; html: string } | null> {
    const sample = this.getSampleData(language);
    const baseSettings = {
      primaryColor: "#2563eb",
      companyName: "Mentingo",
      language,
    };

    const baseOrigin = "https://app.mentingo.com";

    switch (templateId) {
      case "user_invite": {
        const email = new UserInviteEmail({
          invitedByUserName: sample.invitedByName,
          createPasswordLink: `${baseOrigin}/auth/create-password?token=sample-token`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userInvite,
          html: await email.html,
        };
      }

      case "welcome": {
        const email = new WelcomeEmail({
          coursesLink: `${baseOrigin}/courses`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.welcome,
          html: await email.html,
        };
      }

      case "user_first_login": {
        const email = new UserFirstLoginEmail({
          name: sample.userName,
          coursesUrl: `${baseOrigin}/courses`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userFirstLogin,
          html: await email.html,
        };
      }

      case "user_assigned_to_course": {
        const email = new UserAssignedToCourseEmail({
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          formatedCourseDueDate: sample.dueDate,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userAssignedToCourse,
          html: await email.html,
        };
      }

      case "user_short_inactivity": {
        const email = new UserShortInactivityEmail({
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userShortInactivity,
          html: await email.html,
        };
      }

      case "user_long_inactivity": {
        const email = new UserLongInactivityEmail({
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userLongInactivity,
          html: await email.html,
        };
      }

      case "user_finished_chapter": {
        const email = new UserFinishedChapterEmail({
          chapterName: sample.chapterName,
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userFinishedChapter,
          html: await email.html,
        };
      }

      case "user_finished_course": {
        const email = new UserFinishedCourseEmail({
          courseName: sample.courseName,
          buttonLink: `${baseOrigin}/profile/sample-user`,
          hasCertificate: true,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.userFinishedCourse,
          html: await email.html,
        };
      }

      case "create_password_reminder": {
        const email = new CreatePasswordReminderEmail({
          createPasswordLink: `${baseOrigin}/auth/create-password?token=sample-token`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.createPasswordReminder,
          html: await email.html,
        };
      }

      case "certificate_expiration_warning": {
        const email = new CertificateExpirationWarningEmail({
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          expiresAt: sample.expiresAt,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.certificateExpirationWarning,
          html: await email.html,
        };
      }

      case "certificate_expired": {
        const email = new CertificateExpiredEmail({
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          reason: "expired",
          ...baseSettings,
        });
        return {
          subject: sample.subjects.certificateExpired,
          html: await email.html,
        };
      }

      case "announcement": {
        const email = new AnnouncementEmail({
          title: sample.announcementTitle,
          content: sample.announcementContent,
          buttonLink: `${baseOrigin}/announcements/1`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.announcement,
          html: await email.html,
        };
      }

      case "course_due_date_reminder": {
        const email = new CourseDueDateReminderEmail({
          courseName: sample.courseName,
          courseLink: `${baseOrigin}/course/sample-course-id`,
          dueDate: sample.dueDate,
          daysBeforeDueDate: 7,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.courseDueDateReminder,
          html: await email.html,
        };
      }

      case "new_user": {
        const email = new NewUserEmail({
          userName: sample.userFullName,
          profileLink: `${baseOrigin}/admin/users/sample-user`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.newUser,
          html: await email.html,
        };
      }

      case "finished_course": {
        const email = new FinishedCourseEmail({
          userName: sample.userFullName,
          courseName: sample.courseName,
          progressLink: `${baseOrigin}/admin/courses/sample-course/progress`,
          ...baseSettings,
        });
        return {
          subject: sample.subjects.finishedCourse,
          html: await email.html,
        };
      }

      case "default_email":
      default:
        return null;
    }
  }

  private replaceCidReferences(html: string): string {
    const logoUrl = `${CORS_ORIGIN}/app/assets/svgs/app-logo.svg`;
    const borderCircleUrl = `${CORS_ORIGIN}/app/assets/svgs/app-email-border-circle.svg`;

    return html.replace(/cid:logo/g, logoUrl).replace(/cid:border-circle/g, borderCircleUrl);
  }
}
