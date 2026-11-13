import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const quizAttemptGradedAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.QUIZ_ATTEMPT_GRADED,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Quiz graded",
    [SUPPORTED_LANGUAGES.PL]: "Quiz oceniony",
    [SUPPORTED_LANGUAGES.DE]: "Quiz bewertet",
    [SUPPORTED_LANGUAGES.FR]: "Quiz évalué",
    [SUPPORTED_LANGUAGES.ES]: "Cuestionario calificado",
    [SUPPORTED_LANGUAGES.CS]: "Kvíz ohodnocen",
    [SUPPORTED_LANGUAGES.LT]: "Testas įvertintas",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]: "Sent when a reviewer grades a learner's quiz answers.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane, gdy osoba oceniająca oceni odpowiedzi uczestnika w quizie.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird gesendet, wenn eine prüfende Person die Quizantworten eines Lernenden bewertet.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée lorsqu’un évaluateur note les réponses d’un apprenant à un quiz.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía cuando un revisor califica las respuestas de un participante en un cuestionario.",
    [SUPPORTED_LANGUAGES.CS]: "Odesílá se, když hodnotitel ohodnotí odpovědi účastníka v kvízu.",
    [SUPPORTED_LANGUAGES.LT]: "Siunčiama, kai vertintojas įvertina besimokančiojo testo atsakymus.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.QUIZ_ATTEMPT_GRADED,
  mappings: {
    course_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "course_name" },
    lesson_name: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "lesson_name" },
    score: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "score" },
    lesson_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "lesson_link" },
  },
};
