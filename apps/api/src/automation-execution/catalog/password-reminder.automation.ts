import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const passwordReminderAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.PASSWORD_REMINDER,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Password creation reminder",
    [SUPPORTED_LANGUAGES.PL]: "Przypomnienie o utworzeniu hasła",
    [SUPPORTED_LANGUAGES.DE]: "Erinnerung an die Passworterstellung",
    [SUPPORTED_LANGUAGES.FR]: "Rappel de création du mot de passe",
    [SUPPORTED_LANGUAGES.ES]: "Recordatorio de creación de contraseña",
    [SUPPORTED_LANGUAGES.CS]: "Připomenutí vytvoření hesla",
    [SUPPORTED_LANGUAGES.LT]: "Priminimas sukurti slaptažodį",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a user needs to finish creating a password.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy użytkownik musi dokończyć tworzenie hasła.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn ein Benutzer die Erstellung seines Passworts abschließen muss.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée lorsqu’un utilisateur doit terminer la création de son mot de passe.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando un usuario debe terminar de crear su contraseña.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když uživatel potřebuje dokončit vytvoření hesla.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai naudotojas turi baigti kurti slaptažodį.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.PASSWORD_REMINDER,
  mappings: {
    create_password_link: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "create_password_link",
    },
  },
};
