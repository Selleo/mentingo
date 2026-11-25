import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const adminCourseDueDatesAtRiskAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.ADMIN_COURSE_DUE_DATES_AT_RISK,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Course due dates at risk",
    [SUPPORTED_LANGUAGES.PL]: "Zagrożone terminy kursów",
    [SUPPORTED_LANGUAGES.DE]: "Gefährdete Kursfristen",
    [SUPPORTED_LANGUAGES.FR]: "Dates limites de cours menacées",
    [SUPPORTED_LANGUAGES.ES]: "Fechas límite de cursos en riesgo",
    [SUPPORTED_LANGUAGES.CS]: "Ohrožené termíny kurzů",
    [SUPPORTED_LANGUAGES.LT]: "Kursų terminams kyla grėsmė",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]:
      "Sent to administrators once per due date, five days before it, naming the courses that learners have not finished yet.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane do administratorów jednorazowo, pięć dni przed terminem, z kursami, których uczestnicy jeszcze nie ukończyli.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird einmal pro Frist, fünf Tage vorher, an Administratoren gesendet und nennt die Kurse, die Teilnehmende noch nicht abgeschlossen haben.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée une fois aux administrateurs, cinq jours avant chaque date limite, avec les cours que des apprenants n'ont pas encore terminés.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía una vez a los administradores, cinco días antes de cada fecha límite, con los cursos que los estudiantes aún no han completado.",
    [SUPPORTED_LANGUAGES.CS]:
      "Odesílá se správcům jednou, pět dní před každým termínem, s kurzy, které studenti ještě nedokončili.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama administratoriams vieną kartą, likus penkioms dienoms iki kiekvieno termino, su kursais, kurių studentai dar nebaigė.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ADMIN_COURSE_DUE_DATES_AT_RISK,
  mappings: {
    at_risk_courses_summary: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "at_risk_courses_summary",
    },
    at_risk_learners_count: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "at_risk_learners_count",
    },
    at_risk_courses_count: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "at_risk_courses_count",
    },
    report_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "report_link" },
  },
};
