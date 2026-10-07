import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userShortInactivityAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_SHORT_INACTIVITY,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Short inactivity reminder",
    [SUPPORTED_LANGUAGES.PL]: "Przypomnienie po krótkiej nieaktywności",
    [SUPPORTED_LANGUAGES.DE]: "Erinnerung bei kurzer Inaktivität",
    [SUPPORTED_LANGUAGES.FR]: "Rappel après une courte inactivité",
    [SUPPORTED_LANGUAGES.ES]: "Recordatorio tras una breve inactividad",
    [SUPPORTED_LANGUAGES.CS]: "Připomenutí po krátké neaktivitě",
    [SUPPORTED_LANGUAGES.LT]: "Priminimas po trumpo neaktyvumo",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner has recently stopped progressing.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik niedawno przestał robić postępy.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn ein Lernender seit Kurzem keine Fortschritte mehr macht.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un apprenant a récemment cessé de progresser.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando un participante ha dejado de avanzar recientemente.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když účastník nedávno přestal dělat pokroky.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokantysis neseniai nustojo daryti pažangą.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.SHORT_INACTIVITY_COURSE,
  legacySettingKey: "userShortInactivity",
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
  },
};
