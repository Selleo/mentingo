import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const courseDueDateReminderAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.COURSE_DUE_DATE_REMINDER,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Course due-date reminder",
    [SUPPORTED_LANGUAGES.PL]: "Przypomnienie o terminie kursu",
    [SUPPORTED_LANGUAGES.DE]: "Erinnerung an die Kursfrist",
    [SUPPORTED_LANGUAGES.FR]: "Rappel de l’échéance du cours",
    [SUPPORTED_LANGUAGES.ES]: "Recordatorio de la fecha límite del curso",
    [SUPPORTED_LANGUAGES.CS]: "Připomenutí termínu kurzu",
    [SUPPORTED_LANGUAGES.LT]: "Priminimas apie kurso terminą",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a course deadline is approaching.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy zbliża się termin ukończenia kursu.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn die Frist für einen Kurs näher rückt.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsque l’échéance d’un cours approche.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando se acerca la fecha límite de un curso.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když se blíží termín dokončení kurzu.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama artėjant kurso užbaigimo terminui.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.DEADLINE_UPCOMING,
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
    due_date: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "due_date" },
    days_before_due_date: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "days_before_due_date",
    },
  },
};
