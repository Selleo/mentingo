import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const passwordRecoveryAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.PASSWORD_RECOVERY,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Password recovery",
    [SUPPORTED_LANGUAGES.PL]: "Odzyskiwanie hasła",
    [SUPPORTED_LANGUAGES.DE]: "Passwortwiederherstellung",
    [SUPPORTED_LANGUAGES.FR]: "Récupération du mot de passe",
    [SUPPORTED_LANGUAGES.ES]: "Recuperación de contraseña",
    [SUPPORTED_LANGUAGES.CS]: "Obnovení hesla",
    [SUPPORTED_LANGUAGES.LT]: "Slaptažodžio atkūrimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner requests a password reset.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik poprosi o zresetowanie hasła.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn ein Lernender das Zurücksetzen seines Passworts anfordert.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée lorsqu’un apprenant demande la réinitialisation de son mot de passe.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando un participante solicita restablecer su contraseña.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když účastník požádá o obnovení hesla.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokantysis paprašo atkurti slaptažodį.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.PASSWORD_RECOVERY,
  mappings: {
    name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "name" },
    reset_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "reset_link" },
  },
};
