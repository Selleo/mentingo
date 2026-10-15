import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const userInviteAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.USER_INVITE,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "User invitation",
    [SUPPORTED_LANGUAGES.PL]: "Zaproszenie użytkownika",
    [SUPPORTED_LANGUAGES.DE]: "Benutzereinladung",
    [SUPPORTED_LANGUAGES.FR]: "Invitation d’un utilisateur",
    [SUPPORTED_LANGUAGES.ES]: "Invitación de usuario",
    [SUPPORTED_LANGUAGES.CS]: "Pozvánka uživatele",
    [SUPPORTED_LANGUAGES.LT]: "Naudotojo kvietimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a user is invited to the platform.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy użytkownik zostanie zaproszony na platformę.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn ein Benutzer zur Plattform eingeladen wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un utilisateur est invité sur la plateforme.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando se invita a un usuario a la plataforma.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když je uživatel pozván na platformu.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai naudotojas pakviečiamas į platformą.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.USER_INVITE,
  mappings: {
    invited_by_user_name: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "invited_by_user_name",
    },
    create_password_link: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "create_password_link",
    },
  },
};
