import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const forumMentionAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.FORUM_MENTION,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Forum mention",
    [SUPPORTED_LANGUAGES.PL]: "Wzmianka na forum",
    [SUPPORTED_LANGUAGES.DE]: "Erwähnung im Forum",
    [SUPPORTED_LANGUAGES.FR]: "Mention sur le forum",
    [SUPPORTED_LANGUAGES.ES]: "Mención en el foro",
    [SUPPORTED_LANGUAGES.CS]: "Zmínka ve fóru",
    [SUPPORTED_LANGUAGES.LT]: "Paminėjimas forume",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a user is mentioned in a forum topic.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy użytkownik zostanie oznaczony w temacie na forum.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn ein Benutzer in einem Forenthema erwähnt wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un utilisateur est mentionné dans un sujet du forum.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando se menciona a un usuario en un tema del foro.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když je uživatel zmíněn v tématu fóra.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai naudotojas paminimas forumo temoje.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.FORUM_MENTION,
  mappings: {
    authorFullName: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "authorFullName" },
    topic_title: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "topic_title" },
    message: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "message" },
    topic_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "topic_link" },
    unsubscribe_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "unsubscribe_link" },
  },
};
