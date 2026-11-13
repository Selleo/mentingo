import {
  AUTOMATION_EVENT_KINDS,
  AUTOMATION_MAPPING_TYPES,
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import type { BuiltInAutomationDefinition } from "../automation-execution.types";

export const quizGradingDigestAutomation: BuiltInAutomationDefinition = {
  eventKind: AUTOMATION_EVENT_KINDS.QUIZ_GRADING_DIGEST,
  name: {
    [SUPPORTED_LANGUAGES.EN]: "Grading queue digest",
    [SUPPORTED_LANGUAGES.PL]: "Podsumowanie kolejki ocen",
    [SUPPORTED_LANGUAGES.DE]: "Übersicht der Bewertungswarteschlange",
    [SUPPORTED_LANGUAGES.FR]: "Récapitulatif de la file d’évaluation",
    [SUPPORTED_LANGUAGES.ES]: "Resumen de la cola de calificación",
    [SUPPORTED_LANGUAGES.CS]: "Přehled fronty hodnocení",
    [SUPPORTED_LANGUAGES.LT]: "Vertinimo eilės suvestinė",
  },
  description: {
    [SUPPORTED_LANGUAGES.EN]:
      "Sent once a day to reviewers when new quiz answers are waiting for grading.",
    [SUPPORTED_LANGUAGES.PL]:
      "Wysyłane raz dziennie do osób oceniających, gdy nowe odpowiedzi w quizach czekają na ocenę.",
    [SUPPORTED_LANGUAGES.DE]:
      "Wird einmal täglich an prüfende Personen gesendet, wenn neue Quizantworten auf Bewertung warten.",
    [SUPPORTED_LANGUAGES.FR]:
      "Envoyée une fois par jour aux évaluateurs lorsque de nouvelles réponses aux quiz attendent une évaluation.",
    [SUPPORTED_LANGUAGES.ES]:
      "Se envía una vez al día a los revisores cuando hay nuevas respuestas de cuestionarios pendientes de calificación.",
    [SUPPORTED_LANGUAGES.CS]:
      "Odesílá se jednou denně hodnotitelům, když na hodnocení čekají nové odpovědi z kvízů.",
    [SUPPORTED_LANGUAGES.LT]:
      "Siunčiama kartą per dieną vertintojams, kai nauji testų atsakymai laukia įvertinimo.",
  },
  templateKey: BUILT_IN_EMAIL_TEMPLATE_KEYS.QUIZ_GRADING_DIGEST,
  mappings: {
    new_answers_count: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "new_answers_count" },
    pending_answers_count: {
      type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD,
      field: "pending_answers_count",
    },
    grading_queue_link: { type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: "grading_queue_link" },
  },
};
