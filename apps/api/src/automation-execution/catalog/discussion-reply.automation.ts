import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const discussionReplyAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.DISCUSSION_REPLY,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "New replies in a discussion",
    [SUPPORTED_LANGUAGES.PL]: "Nowe odpowiedzi w dyskusji",
    [SUPPORTED_LANGUAGES.DE]: "Neue Antworten in einer Diskussion",
    [SUPPORTED_LANGUAGES.FR]: "Nouvelles réponses dans une discussion",
    [SUPPORTED_LANGUAGES.ES]: "Nuevas respuestas en una discusión",
    [SUPPORTED_LANGUAGES.CS]: "Nové odpovědi v diskusi",
    [SUPPORTED_LANGUAGES.LT]: "Nauji atsakymai diskusijoje",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]:
      "Sent to the participants of a course discussion thread or a forum topic about new replies, grouped into one email.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane do uczestników wątku w dyskusji kursu lub tematu na forum o nowych odpowiedziach, zebranych w jedną wiadomość.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird an die Teilnehmer eines Kursdiskussions-Threads oder Forenthemas über neue Antworten gesendet, zusammengefasst in einer E-Mail.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée aux participants d’un fil de discussion de cours ou d’un sujet du forum au sujet des nouvelles réponses, regroupées dans un seul e-mail.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía a los participantes de un hilo de discusión del curso o de un tema del foro sobre las nuevas respuestas, agrupadas en un solo correo.",
    [SUPPORTED_LANGUAGES.CS]:
      "Odesílá se účastníkům vlákna diskuse kurzu nebo tématu fóra o nových odpovědích, seskupených do jednoho e-mailu.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama kurso diskusijos gijos arba forumo temos dalyviams apie naujus atsakymus, sugrupuotus į vieną laišką.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.DISCUSSION_REPLY,
  mappings: {
    discussion_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "discussion_name" },
    reply_count: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "reply_count" },
    reply_authors: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "reply_authors" },
    latest_reply: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "latest_reply" },
    discussion_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "discussion_link" },
    unfollow_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "unfollow_link" },
    unsubscribe_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "unsubscribe_link" },
  },
};
