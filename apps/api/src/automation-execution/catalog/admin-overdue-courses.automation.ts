import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const adminOverdueCoursesAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Overdue courses notification",
    [SUPPORTED_LANGUAGES.PL]: "Powiadomienie o zaległych kursach",
    [SUPPORTED_LANGUAGES.DE]: "Benachrichtigung über überfällige Kurse",
    [SUPPORTED_LANGUAGES.FR]: "Notification de cours en retard",
    [SUPPORTED_LANGUAGES.ES]: "Notificación de cursos atrasados",
    [SUPPORTED_LANGUAGES.CS]: "Oznámení o kurzech po termínu",
    [SUPPORTED_LANGUAGES.LT]: "Pranešimas apie kursus, kurių terminas praleistas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent to administrators about learners with overdue courses.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane do administratorów w sprawie uczestników z kursami po terminie.",
    [SUPPORTED_LANGUAGES.DE]: "Informiert Administratoren über Lernende mit überfälligen Kursen.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée aux administrateurs au sujet des apprenants dont les cours sont en retard.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía a los administradores sobre participantes con cursos cuyo plazo ha vencido.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se správcům ohledně účastníků s kurzy po termínu.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama administratoriams apie besimokančiuosius, praleidusius kursų užbaigimo terminus.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ADMIN_OVERDUE_COURSES,
  mappings: {
    overdue_courses_summary: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "overdue_courses_summary",
    },
    courses_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "courses_link" },
  },
};
