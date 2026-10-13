import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userFirstLoginAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_FIRST_LOGIN,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "First login",
    [SUPPORTED_LANGUAGES.PL]: "Pierwsze logowanie",
    [SUPPORTED_LANGUAGES.DE]: "Erste Anmeldung",
    [SUPPORTED_LANGUAGES.FR]: "Première connexion",
    [SUPPORTED_LANGUAGES.ES]: "Primer inicio de sesión",
    [SUPPORTED_LANGUAGES.CS]: "První přihlášení",
    [SUPPORTED_LANGUAGES.LT]: "Pirmasis prisijungimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent after a learner's first successful login.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane po pierwszym udanym logowaniu uczestnika.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird nach der ersten erfolgreichen Anmeldung eines Lernenden gesendet.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée après la première connexion réussie d’un apprenant.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía después del primer inicio de sesión correcto de un participante.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se po prvním úspěšném přihlášení účastníka.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama po pirmojo sėkmingo besimokančiojo prisijungimo.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.USER_FIRST_LOGIN,
  legacySettingKey: "userFirstLogin",
  mappings: {
    name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "name" },
    courses_url: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "courses_url" },
  },
};
