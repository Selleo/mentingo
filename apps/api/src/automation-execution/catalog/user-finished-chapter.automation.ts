import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userFinishedChapterAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_FINISHED_CHAPTER,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Chapter completion",
    [SUPPORTED_LANGUAGES.PL]: "Ukończenie rozdziału",
    [SUPPORTED_LANGUAGES.DE]: "Kapitelabschluss",
    [SUPPORTED_LANGUAGES.FR]: "Fin de chapitre",
    [SUPPORTED_LANGUAGES.ES]: "Finalización de capítulo",
    [SUPPORTED_LANGUAGES.CS]: "Dokončení kapitoly",
    [SUPPORTED_LANGUAGES.LT]: "Skyriaus užbaigimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner completes a chapter.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik ukończy rozdział.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn ein Lernender ein Kapitel abschließt.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un apprenant termine un chapitre.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando un participante completa un capítulo.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když účastník dokončí kapitolu.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokantysis užbaigia skyrių.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.USER_FINISHED_CHAPTER,
  legacySettingKey: "userChapterFinished",
  mappings: {
    chapter_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "chapter_name" },
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
  },
};
