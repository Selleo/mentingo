import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const liveTrainingEndedAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_ENDED,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Live training ended",
    [SUPPORTED_LANGUAGES.PL]: "Szkolenie na żywo zakończone",
    [SUPPORTED_LANGUAGES.DE]: "Live-Schulung beendet",
    [SUPPORTED_LANGUAGES.FR]: "Formation en direct terminée",
    [SUPPORTED_LANGUAGES.ES]: "Formación en directo finalizada",
    [SUPPORTED_LANGUAGES.CS]: "Živé školení skončilo",
    [SUPPORTED_LANGUAGES.LT]: "Tiesioginiai mokymai baigti",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a live training is ended.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy szkolenie na żywo zostanie zakończone.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn eine Live-Schulung beendet wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’une formation en direct est terminée.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando finaliza una formación en directo.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se při ukončení živého školení.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai tiesioginiai mokymai baigiami.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.LIVE_TRAINING_ENDED,
  mappings: {
    title: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "title" },
    content: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "content" },
    live_training_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "live_training_link" },
  },
};
