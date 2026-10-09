import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const welcomeAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.WELCOME,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Welcome",
    [SUPPORTED_LANGUAGES.PL]: "Powitanie",
    [SUPPORTED_LANGUAGES.DE]: "Willkommen",
    [SUPPORTED_LANGUAGES.FR]: "Bienvenue",
    [SUPPORTED_LANGUAGES.ES]: "Bienvenida",
    [SUPPORTED_LANGUAGES.CS]: "Uvítání",
    [SUPPORTED_LANGUAGES.LT]: "Pasveikinimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner's account is created.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy zostanie utworzone konto uczestnika.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn das Konto eines Lernenden erstellt wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsque le compte d’un apprenant est créé.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando se crea la cuenta de un participante.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se při vytvoření účtu účastníka.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai sukuriama besimokančiojo paskyra.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.WELCOME,
  mappings: {
    courses_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "courses_link" },
  },
};
