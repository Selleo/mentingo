import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userAssignedToCourseAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_ASSIGNED_TO_COURSE,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Course assignment",
    [SUPPORTED_LANGUAGES.PL]: "Przypisanie do kursu",
    [SUPPORTED_LANGUAGES.DE]: "Kurszuweisung",
    [SUPPORTED_LANGUAGES.FR]: "Attribution d’un cours",
    [SUPPORTED_LANGUAGES.ES]: "Asignación de curso",
    [SUPPORTED_LANGUAGES.CS]: "Přiřazení kurzu",
    [SUPPORTED_LANGUAGES.LT]: "Kurso priskyrimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner is assigned to a course.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik zostanie przypisany do kursu.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn einem Lernenden ein Kurs zugewiesen wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un cours est attribué à un apprenant.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando se asigna un curso a un participante.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když je účastníkovi přiřazen kurz.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokančiajam priskiriamas kursas.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ASSIGNMENT_WITH_DEADLINE,
  legacySettingKey: "userCourseAssignment",
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
    formatted_course_due_date: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "formatted_course_due_date",
    },
  },
};
