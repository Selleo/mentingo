import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const adminFinishedCourseAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Admin course completion notification",
    [SUPPORTED_LANGUAGES.PL]: "Powiadomienie administratora o ukończeniu kursu",
    [SUPPORTED_LANGUAGES.DE]: "Benachrichtigung an Administratoren zum Kursabschluss",
    [SUPPORTED_LANGUAGES.FR]: "Notification de fin de cours aux administrateurs",
    [SUPPORTED_LANGUAGES.ES]: "Notificación de finalización de curso para administradores",
    [SUPPORTED_LANGUAGES.CS]: "Oznámení správci o dokončení kurzu",
    [SUPPORTED_LANGUAGES.LT]: "Pranešimas administratoriams apie kurso užbaigimą",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent to administrators when a learner completes a course.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane do administratorów, gdy uczestnik ukończy kurs.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird an Administratoren gesendet, wenn ein Lernender einen Kurs abschließt.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée aux administrateurs lorsqu’un apprenant termine un cours.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía a los administradores cuando un participante completa un curso.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se správcům, když účastník dokončí kurz.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama administratoriams, kai besimokantysis užbaigia kursą.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ADMIN_FINISHED_COURSE,
  mappings: {
    user_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "user_name" },
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    progress_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "progress_link" },
  },
};
