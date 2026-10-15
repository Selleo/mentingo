import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const liveTrainingReminderAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_REMINDER,
  legacyDescription: "Sent when a live training is reminder.",
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Live training reminder",
    [SUPPORTED_LANGUAGES.PL]: "Przypomnienie o szkoleniu na żywo",
    [SUPPORTED_LANGUAGES.DE]: "Erinnerung an eine Live-Schulung",
    [SUPPORTED_LANGUAGES.FR]: "Rappel de formation en direct",
    [SUPPORTED_LANGUAGES.ES]: "Recordatorio de formación en directo",
    [SUPPORTED_LANGUAGES.CS]: "Připomenutí živého školení",
    [SUPPORTED_LANGUAGES.LT]: "Priminimas apie tiesioginius mokymus",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent as a reminder for an upcoming live training.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane jako przypomnienie o nadchodzącym szkoleniu na żywo.",
    [SUPPORTED_LANGUAGES.DE]: "Wird als Erinnerung an eine bevorstehende Live-Schulung gesendet.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée pour rappeler une formation en direct à venir.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía como recordatorio de una próxima formación en directo.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se jako připomenutí nadcházejícího živého školení.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama kaip priminimas apie artėjančius tiesioginius mokymus.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.LIVE_TRAINING_REMINDER,
  mappings: {
    title: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "title" },
    content: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "content" },
    live_training_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "live_training_link" },
  },
};
