import type { SupportedLanguages } from "@repo/shared";

// shortcut: a fixed 24 h window matching the daily cron, upgrade to a stored "last digest" mark
// if the schedule ever becomes configurable.
export const QUIZ_GRADING_DIGEST_WINDOW_HOURS = 24;

export const QUIZ_GRADED_ANNOUNCEMENT_TITLES: Record<SupportedLanguages, string> = {
  en: "Your quiz has been graded",
  pl: "Twój quiz został oceniony",
  de: "Dein Quiz wurde bewertet",
  lt: "Tavo testas įvertintas",
  cs: "Tvůj kvíz byl ohodnocen",
  es: "Tu cuestionario ha sido calificado",
  fr: "Votre quiz a été évalué",
};

export const QUIZ_GRADED_ANNOUNCEMENT_CONTENTS: Record<
  SupportedLanguages,
  (lessonLink: string, courseName: string, score: number) => string
> = {
  en: (lessonLink, courseName, score) =>
    `A reviewer has graded your answers in ${lessonLink} (${courseName}). Your score: ${score}%.`,
  pl: (lessonLink, courseName, score) =>
    `Osoba oceniająca sprawdziła Twoje odpowiedzi w lekcji ${lessonLink} (${courseName}). Twój wynik: ${score}%.`,
  de: (lessonLink, courseName, score) =>
    `Deine Antworten in ${lessonLink} (${courseName}) wurden bewertet. Dein Ergebnis: ${score} %.`,
  lt: (lessonLink, courseName, score) =>
    `Vertintojas įvertino tavo atsakymus pamokoje ${lessonLink} (${courseName}). Tavo rezultatas: ${score}%.`,
  cs: (lessonLink, courseName, score) =>
    `Hodnotitel ohodnotil tvé odpovědi v lekci ${lessonLink} (${courseName}). Tvůj výsledek: ${score} %.`,
  es: (lessonLink, courseName, score) =>
    `Un revisor ha calificado tus respuestas en ${lessonLink} (${courseName}). Tu puntuación: ${score} %.`,
  fr: (lessonLink, courseName, score) =>
    `Un évaluateur a noté vos réponses dans ${lessonLink} (${courseName}). Votre score : ${score} %.`,
};
