import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userFinishedCourseAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Course completion",
    [SUPPORTED_LANGUAGES.PL]: "Ukończenie kursu",
    [SUPPORTED_LANGUAGES.DE]: "Kursabschluss",
    [SUPPORTED_LANGUAGES.FR]: "Fin de cours",
    [SUPPORTED_LANGUAGES.ES]: "Finalización de curso",
    [SUPPORTED_LANGUAGES.CS]: "Dokončení kurzu",
    [SUPPORTED_LANGUAGES.LT]: "Kurso užbaigimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner completes a course.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik ukończy kurs.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn ein Lernender einen Kurs abschließt.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un apprenant termine un cours.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando un participante completa un curso.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když účastník dokončí kurz.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokantysis užbaigia kursą.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.COMPLETION_WITH_CERTIFICATE,
  legacySettingKey: "userCourseFinished",
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    button_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "button_link" },
    has_certificate: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "has_certificate" },
  },
};
