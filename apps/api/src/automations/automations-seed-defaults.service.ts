import { Injectable, Logger } from "@nestjs/common";
import {
  AUTOMATION_TRIGGER_TYPES,
  STEP_DEFINITIONS,
  type SupportedLanguages,
  type TriggerType,
  type LocalizedText,
} from "@repo/shared";

import { AutomationStatus } from "src/announcements/types/automations.types";

import { AutomationStepsService } from "./automations-steps/automations-steps.service";
import { AutomationsService } from "./automations.service";

import type { AutomationRecordInput } from "src/announcements/types/automations-source.types";
import type { UUIDType } from "src/common";

const TRIGGER_TO_TEMPLATE: Record<TriggerType, string> = {
  user_invited: "user_invite",
  users_imported_invite: "user_invite",
  user_password_reminder: "create_password_reminder",
  user_welcome: "welcome",
  user_first_login: "user_first_login",
  users_assigned_to_course: "user_assigned_to_course",
  users_short_inactivity: "user_short_inactivity",
  users_long_inactivity: "user_long_inactivity",
  user_chapter_finished: "user_finished_chapter",
  user_course_finished: "user_finished_course",
  user_registered: "new_user",
  user_password_created: "welcome",
  course_completed: "finished_course",
  certificate_expiration_warning: "certificate_expiration_warning",
  certificate_archived: "certificate_expired",
  announcement_published: "announcement",
  course_chat_user_mentioned: "announcement",
  course_due_date_reminder: "course_due_date_reminder",
};

const TEMPLATE_VARIABLE_MAPPINGS: Record<string, Record<string, string>> = {
  user_invite: {
    invitedByUserName: "invitedByUserName",
    createPasswordLink: "inviteLink",
  },
  welcome: {
    coursesLink: "platformUrl",
  },
  user_first_login: {
    name: "userFirstName",
    coursesUrl: "platformUrl",
  },
  user_assigned_to_course: {
    courseName: "courseName",
    courseLink: "courseUrl",
    formatedCourseDueDate: "dueDate",
  },
  user_short_inactivity: {
    courseName: "courseName",
    courseLink: "courseUrl",
  },
  user_long_inactivity: {
    courseName: "courseName",
    courseLink: "courseUrl",
  },
  user_finished_chapter: {
    chapterName: "chapterName",
    courseName: "courseName",
    courseLink: "courseUrl",
  },
  user_finished_course: {
    courseName: "courseName",
    buttonLink: "courseUrl",
    hasCertificate: "hasCertificate",
  },
  create_password_reminder: {
    createPasswordLink: "resetPasswordLink",
  },
  certificate_expiration_warning: {
    courseName: "certificateName",
    courseLink: "courseUrl",
    expiresAt: "expirationDate",
  },
  certificate_expired: {
    courseName: "certificateName",
    courseLink: "courseUrl",
  },
  announcement: {
    title: "announcementTitle",
    content: "announcementContent",
    buttonLink: "announcementUrl",
  },
  course_due_date_reminder: {
    courseName: "courseName",
    courseLink: "courseUrl",
    dueDate: "dueDate",
    daysBeforeDueDate: "daysLeft",
  },
  new_user: {
    userName: "userName",
    profileLink: "profileLink",
  },
  finished_course: {
    userName: "userName",
    courseName: "courseName",
    progressLink: "progressLink",
  },
};

const TRIGGER_NAMES: Record<TriggerType, Record<SupportedLanguages, string>> = {
  user_invited: {
    pl: "Zaproszenie użytkownika",
    en: "User Invitation",
    de: "Benutzereinladung",
    lt: "Vartotojo pakvietimas",
    cs: "Pozvánka uživatele",
    es: "Invitación de usuario",
  },
  users_imported_invite: {
    pl: "Zaproszenie importowanych użytkowników",
    en: "Imported Users Invitation",
    de: "Einladung importierter Benutzer",
    lt: "Importuotų vartotojų pakvietimas",
    cs: "Pozvánka importovaných uživatelů",
    es: "Invitación de usuarios importados",
  },
  user_password_reminder: {
    pl: "Przypomnienie hasła",
    en: "Password Reminder",
    de: "Passworterinnerung",
    lt: "Slaptažodžio priminimas",
    cs: "Připomínka hesla",
    es: "Recordatorio de contraseña",
  },
  user_welcome: {
    pl: "Powitanie użytkownika",
    en: "User Welcome",
    de: "Benutzerbegrüßung",
    lt: "Vartotojo pasisveikinimas",
    cs: "Přivítání uživatele",
    es: "Bienvenida del usuario",
  },
  user_first_login: {
    pl: "Pierwsze logowanie",
    en: "First Login",
    de: "Erste Anmeldung",
    lt: "Pirmas prisijungimas",
    cs: "První přihlášení",
    es: "Primer inicio de sesión",
  },
  users_assigned_to_course: {
    pl: "Przypisanie do kursu",
    en: "Course Assignment",
    de: "Kurszuweisung",
    lt: "Priskyrimas kursui",
    cs: "Přiřazení ke kurzu",
    es: "Asignación al curso",
  },
  users_short_inactivity: {
    pl: "Krótka nieaktywność",
    en: "Short Inactivity",
    de: "Kurze Inaktivität",
    lt: "Trumpa neaktyvumo periodo",
    cs: "Krátká neaktivita",
    es: "Inactividad corta",
  },
  users_long_inactivity: {
    pl: "Długa nieaktywność",
    en: "Long Inactivity",
    de: "Lange Inaktivität",
    lt: "Ilga neaktyvumo periodo",
    cs: "Dlouhá neaktivita",
    es: "Inactividad prolongada",
  },
  user_chapter_finished: {
    pl: "Ukończenie rozdziału",
    en: "Chapter Completed",
    de: "Kapitel abgeschlossen",
    lt: "Skyrius baigtas",
    cs: "Kapitola dokončena",
    es: "Capítulo completado",
  },
  user_course_finished: {
    pl: "Ukończenie kursu (użytkownik)",
    en: "Course Completed (User)",
    de: "Kurs abgeschlossen (Benutzer)",
    lt: "Kursas baigtas (vartotojas)",
    cs: "Kurz dokončen (uživatel)",
    es: "Curso completado (usuario)",
  },
  user_registered: {
    pl: "Rejestracja nowego użytkownika",
    en: "New User Registered",
    de: "Neuer Benutzer registriert",
    lt: "Naujas vartotojas užregistruotas",
    cs: "Nový uživatel zaregistrován",
    es: "Nuevo usuario registrado",
  },
  user_password_created: {
    pl: "Utworzenie hasła",
    en: "Password Created",
    de: "Passwort erstellt",
    lt: "Slaptažodis sukurtas",
    cs: "Heslo vytvořeno",
    es: "Contraseña creada",
  },
  course_completed: {
    pl: "Ukończenie kursu (admin)",
    en: "Course Completed (Admin)",
    de: "Kurs abgeschlossen (Admin)",
    lt: "Kursas baigtas (admin)",
    cs: "Kurz dokončen (admin)",
    es: "Curso completado (admin)",
  },
  certificate_expiration_warning: {
    pl: "Ostrzeżenie o wygaśnięciu certyfikatu",
    en: "Certificate Expiration Warning",
    de: "Zertifikat-Ablaufwarnung",
    lt: "Sertifikato galiojimo pabaigos įspėjimas",
    cs: "Varování o vypršení certifikátu",
    es: "Aviso de expiración del certificado",
  },
  certificate_archived: {
    pl: "Certyfikat zarchiwizowany",
    en: "Certificate Archived",
    de: "Zertifikat archiviert",
    lt: "Sertifikatas archyvuotas",
    cs: "Certifikát archivován",
    es: "Certificado archivado",
  },
  announcement_published: {
    pl: "Opublikowanie ogłoszenia",
    en: "Announcement Published",
    de: "Ankündigung veröffentlicht",
    lt: "Skelbimas paskelbtas",
    cs: "Oznámení zveřejněno",
    es: "Anuncio publicado",
  },
  course_chat_user_mentioned: {
    pl: "Wzmianka w czacie kursu",
    en: "Course Chat Mention",
    de: "Erwähnung im Kurschat",
    lt: "Paminėjimas kurso pokalbyje",
    cs: "Zmínka v chatu kurzu",
    es: "Mención en el chat del curso",
  },
  course_due_date_reminder: {
    pl: "Przypomnienie o terminie kursu",
    en: "Course Due Date Reminder",
    de: "Kurs-Fälligkeitserinnerung",
    lt: "Kurso termino priminimas",
    cs: "Připomínka termínu kurzu",
    es: "Recordatorio de fecha límite del curso",
  },
};

const DESCRIPTION_TEMPLATES: Record<SupportedLanguages, string> = {
  pl: "Domyślna automatyzacja dla zdarzenia: ",
  en: "Default automation for event: ",
  de: "Standardautomatisierung für Ereignis: ",
  lt: "Numatytasis automatizavimas įvykiui: ",
  cs: "Výchozí automatizace pro událost: ",
  es: "Automatización predeterminada para evento: ",
};

const SEND_EMAIL_LABELS: Record<SupportedLanguages, string> = {
  pl: "Wyślij e-mail",
  en: "Send email",
  de: "E-Mail senden",
  lt: "Siųsti el. laišką",
  cs: "Odeslat e-mail",
  es: "Enviar correo",
};

export interface SeedDefaultsResult {
  created: number;
  skipped: number;
  total: number;
}

@Injectable()
export class AutomationsSeedDefaultsService {
  private readonly logger = new Logger(AutomationsSeedDefaultsService.name);

  constructor(
    private readonly automationsService: AutomationsService,
    private readonly automationStepsService: AutomationStepsService,
  ) {}

  async seedDefaults(
    tenantId: UUIDType,
    language: SupportedLanguages,
  ): Promise<SeedDefaultsResult> {
    const existingAutomations = await this.automationsService.getAllAutomations(tenantId);

    const existingTriggerTypes = new Set<string>();

    for (const automation of existingAutomations) {
      const steps = await this.automationStepsService.getAllAutomationSteps(automation.id);
      for (const step of steps) {
        if (step.type === "trigger" && step.typeContext?.name) {
          existingTriggerTypes.add(step.typeContext.name);
        }
      }
    }

    let created = 0;
    let skipped = 0;

    for (const triggerType of AUTOMATION_TRIGGER_TYPES) {
      if (existingTriggerTypes.has(triggerType)) {
        skipped++;
        continue;
      }

      try {
        await this.createDefaultAutomation(triggerType, language);
        created++;
      } catch (error) {
        this.logger.error(`Failed to create default automation for trigger: ${triggerType}`, error);
        skipped++;
      }
    }

    return {
      created,
      skipped,
      total: AUTOMATION_TRIGGER_TYPES.length,
    };
  }

  private async createDefaultAutomation(
    triggerType: TriggerType,
    language: SupportedLanguages,
  ): Promise<void> {
    const names = TRIGGER_NAMES[triggerType];
    const templateId = TRIGGER_TO_TEMPLATE[triggerType];

    const name: LocalizedText = {};
    const description: LocalizedText = {};

    for (const [lang, label] of Object.entries(names)) {
      const key = lang as SupportedLanguages;
      name[key] = label;
      description[key] = `${DESCRIPTION_TEMPLATES[key]}${label}`;
    }

    const input: AutomationRecordInput = {
      name,
      description,
      status: AutomationStatus.Enabled,
    };

    const automation = await this.automationsService.createAutomation(input);

    const triggerDef = STEP_DEFINITIONS.find((s) => s.kind === "trigger" && s.type === triggerType);

    const triggerLabel = names[language] ?? names.en;

    const triggerStepId = await this.automationStepsService.createAutomationStep({
      parentId: null,
      automationId: automation.id,
      type: "trigger",
      typeContext: {
        name: triggerType,
        label: triggerLabel,
        config: {},
        position: { x: 0, y: 0 },
        providedVariables: triggerDef?.providedVariables ?? [],
      } as any,
    });

    const placeholderValues = TEMPLATE_VARIABLE_MAPPINGS[templateId] ?? {};

    const actionLabel = SEND_EMAIL_LABELS[language] ?? SEND_EMAIL_LABELS.en;

    await this.automationStepsService.createAutomationStep({
      parentId: triggerStepId,
      automationId: automation.id,
      type: "action",
      typeContext: {
        name: "send_email",
        label: actionLabel,
        config: {
          emailTemplate: templateId,
          language: "user_default",
          placeholderValues,
        },
        position: { x: 0, y: 150 },
        providedVariables: [],
      } as any,
    });
  }
}
