import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const liveTrainingStartedAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.LIVE_TRAINING_STARTED,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Live training started",
    [SUPPORTED_LANGUAGES.PL]: "Szkolenie na żywo rozpoczęte",
    [SUPPORTED_LANGUAGES.DE]: "Live-Schulung gestartet",
    [SUPPORTED_LANGUAGES.FR]: "Formation en direct commencée",
    [SUPPORTED_LANGUAGES.ES]: "Formación en directo iniciada",
    [SUPPORTED_LANGUAGES.CS]: "Živé školení začalo",
    [SUPPORTED_LANGUAGES.LT]: "Tiesioginiai mokymai pradėti",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a live training is started.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy szkolenie na żywo zostanie rozpoczęte.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn eine Live-Schulung gestartet wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’une formation en direct commence.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando comienza una formación en directo.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se při zahájení živého školení.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai tiesioginiai mokymai pradedami.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.LIVE_TRAINING_STARTED,
  mappings: {
    title: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "title" },
    content: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "content" },
    live_training_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "live_training_link" },
  },
};
