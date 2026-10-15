import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const adminNewUserAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.ADMIN_NEW_USER,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "New user notification",
    [SUPPORTED_LANGUAGES.PL]: "Powiadomienie o nowym użytkowniku",
    [SUPPORTED_LANGUAGES.DE]: "Benachrichtigung über neue Benutzer",
    [SUPPORTED_LANGUAGES.FR]: "Notification de nouvel utilisateur",
    [SUPPORTED_LANGUAGES.ES]: "Notificación de nuevo usuario",
    [SUPPORTED_LANGUAGES.CS]: "Oznámení o novém uživateli",
    [SUPPORTED_LANGUAGES.LT]: "Pranešimas apie naują naudotoją",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent to administrators when a new user registers.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane do administratorów, gdy zarejestruje się nowy użytkownik.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird an Administratoren gesendet, wenn sich ein neuer Benutzer registriert.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée aux administrateurs lorsqu’un nouvel utilisateur s’inscrit.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía a los administradores cuando se registra un nuevo usuario.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se správcům, když se zaregistruje nový uživatel.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama administratoriams, kai užsiregistruoja naujas naudotojas.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ADMIN_NEW_USER,
  mappings: {
    user_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "user_name" },
    profile_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "profile_link" },
  },
};
