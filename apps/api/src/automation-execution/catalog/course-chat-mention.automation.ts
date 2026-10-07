import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const courseChatMentionAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.COURSE_CHAT_MENTION,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Course chat mention",
    [SUPPORTED_LANGUAGES.PL]: "Wzmianka na czacie kursu",
    [SUPPORTED_LANGUAGES.DE]: "Erwähnung im Kurschat",
    [SUPPORTED_LANGUAGES.FR]: "Mention dans le chat du cours",
    [SUPPORTED_LANGUAGES.ES]: "Mención en el chat del curso",
    [SUPPORTED_LANGUAGES.CS]: "Zmínka v chatu kurzu",
    [SUPPORTED_LANGUAGES.LT]: "Paminėjimas kurso pokalbyje",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a learner is mentioned in course chat.",
    [SUPPORTED_LANGUAGES.PL]: "Wysyłane, gdy uczestnik zostanie oznaczony na czacie kursu.",
    [SUPPORTED_LANGUAGES.DE]: "Wird gesendet, wenn ein Lernender im Kurschat erwähnt wird.",
    [SUPPORTED_LANGUAGES.FR]: "Envoyée lorsqu’un apprenant est mentionné dans le chat du cours.",
    [SUPPORTED_LANGUAGES.ES]: "Se envía cuando se menciona a un participante en el chat del curso.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když je účastník zmíněn v chatu kurzu.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai besimokantysis paminimas kurso pokalbyje.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.COURSE_CHAT_MENTION,
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    message: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "message" },
    course_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_link" },
  },
};
