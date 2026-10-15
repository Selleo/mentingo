import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const announcementAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.ANNOUNCEMENT,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Announcement",
    [SUPPORTED_LANGUAGES.PL]: "Ogłoszenie",
    [SUPPORTED_LANGUAGES.DE]: "Ankündigung",
    [SUPPORTED_LANGUAGES.FR]: "Annonce",
    [SUPPORTED_LANGUAGES.ES]: "Anuncio",
    [SUPPORTED_LANGUAGES.CS]: "Oznámení",
    [SUPPORTED_LANGUAGES.LT]: "Skelbimas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when an announcement is delivered by email.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy ogłoszenie jest dostarczane pocztą elektroniczną.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn eine Ankündigung per E-Mail zugestellt wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’une annonce est transmise par e-mail.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando un anuncio se entrega por correo electrónico.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se při doručení oznámení e-mailem.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai skelbimas pristatomas el. paštu.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.ANNOUNCEMENT,
  mappings: {
    title: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "title" },
    content: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "content" },
    button_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "button_link" },
  },
};
