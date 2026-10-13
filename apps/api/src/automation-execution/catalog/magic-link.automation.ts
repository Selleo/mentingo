import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const magicLinkAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.MAGIC_LINK,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Magic link",
    [SUPPORTED_LANGUAGES.PL]: "Link do logowania bez hasła",
    [SUPPORTED_LANGUAGES.DE]: "Anmeldelink ohne Passwort",
    [SUPPORTED_LANGUAGES.FR]: "Lien de connexion sans mot de passe",
    [SUPPORTED_LANGUAGES.ES]: "Enlace de acceso sin contraseña",
    [SUPPORTED_LANGUAGES.CS]: "Odkaz pro přihlášení bez hesla",
    [SUPPORTED_LANGUAGES.LT]: "Prisijungimo be slaptažodžio nuoroda",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a user requests a passwordless login link.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy użytkownik poprosi o link do logowania bez hasła.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn ein Benutzer einen Anmeldelink ohne Passwort anfordert.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée lorsqu’un utilisateur demande un lien de connexion sans mot de passe.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía cuando un usuario solicita un enlace de acceso sin contraseña.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když uživatel požádá o odkaz pro přihlášení bez hesla.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama, kai naudotojas paprašo prisijungimo be slaptažodžio nuorodos.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.MAGIC_LINK,
  mappings: {
    magic_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "magic_link" },
  },
};
