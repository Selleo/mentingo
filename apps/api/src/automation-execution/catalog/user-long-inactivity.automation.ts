import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userLongInactivityAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_LONG_INACTIVITY,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Long inactivity reminder",
    [SUPPORTED_LANGUAGES.PL]: "Przypomnienie po długiej nieaktywności",
    [SUPPORTED_LANGUAGES.DE]: "Erinnerung bei längerer Inaktivität",
    [SUPPORTED_LANGUAGES.FR]: "Rappel après une longue inactivité",
    [SUPPORTED_LANGUAGES.ES]: "Recordatorio tras una inactividad prolongada",
    [SUPPORTED_LANGUAGES.CS]: "Připomenutí po dlouhé neaktivitě",
    [SUPPORTED_LANGUAGES.LT]: "Priminimas po ilgo neaktyvumo",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner has been inactive for a longer period.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik pozostaje nieaktywny przez dłuższy czas.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn ein Lernender über einen längeren Zeitraum inaktiv war.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée lorsqu’un apprenant est inactif depuis une période prolongée.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía cuando un participante lleva un período prolongado sin actividad.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když je účastník delší dobu neaktivní.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokantysis ilgą laiką yra neaktyvus.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.LONG_INACTIVITY_COURSE,
  legacySettingKey: "userLongInactivity",
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
  },
};
