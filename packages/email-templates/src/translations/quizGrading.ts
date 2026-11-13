import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getQuizAttemptGradedEmailTranslations = (
  language: SupportedLanguages,
  lessonName: string,
  courseName: string,
  score: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Your quiz has been graded",
      paragraphs: [
        `A reviewer has graded your answers in ${lessonName} (${courseName}).`,
        `Your score: ${score}%.`,
      ],
      buttonText: "VIEW RESULTS",
    },
    pl: {
      heading: "Twój quiz został oceniony",
      paragraphs: [
        `Osoba oceniająca sprawdziła Twoje odpowiedzi w lekcji ${lessonName} (${courseName}).`,
        `Twój wynik: ${score}%.`,
      ],
      buttonText: "ZOBACZ WYNIKI",
    },
    de: {
      heading: "Dein Quiz wurde bewertet",
      paragraphs: [
        `Deine Antworten in ${lessonName} (${courseName}) wurden bewertet.`,
        `Dein Ergebnis: ${score} %.`,
      ],
      buttonText: "ERGEBNISSE ANSEHEN",
    },
    lt: {
      heading: "Tavo testas įvertintas",
      paragraphs: [
        `Vertintojas įvertino tavo atsakymus pamokoje ${lessonName} (${courseName}).`,
        `Tavo rezultatas: ${score}%.`,
      ],
      buttonText: "PERŽIŪRĖTI REZULTATUS",
    },
    cs: {
      heading: "Tvůj kvíz byl ohodnocen",
      paragraphs: [
        `Hodnotitel ohodnotil tvé odpovědi v lekci ${lessonName} (${courseName}).`,
        `Tvůj výsledek: ${score} %.`,
      ],
      buttonText: "ZOBRAZIT VÝSLEDKY",
    },
    es: {
      heading: "Tu cuestionario ha sido calificado",
      paragraphs: [
        `Un revisor ha calificado tus respuestas en ${lessonName} (${courseName}).`,
        `Tu puntuación: ${score} %.`,
      ],
      buttonText: "VER RESULTADOS",
    },
    fr: {
      heading: "Votre quiz a été évalué",
      paragraphs: [
        `Un évaluateur a noté vos réponses dans ${lessonName} (${courseName}).`,
        `Votre score : ${score} %.`,
      ],
      buttonText: "VOIR LES RÉSULTATS",
    },
  };

  return emailContent[language];
};

export const getQuizGradingDigestEmailTranslations = (
  language: SupportedLanguages,
  newAnswersCount: string,
  pendingAnswersCount: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Answers waiting for review",
      paragraphs: [
        `New answers submitted in the last 24 hours: ${newAnswersCount}.`,
        `All answers waiting in the grading queue: ${pendingAnswersCount}.`,
      ],
      buttonText: "OPEN GRADING QUEUE",
    },
    pl: {
      heading: "Odpowiedzi czekające na ocenę",
      paragraphs: [
        `Nowe odpowiedzi przesłane w ciągu ostatnich 24 godzin: ${newAnswersCount}.`,
        `Wszystkie odpowiedzi w kolejce do oceny: ${pendingAnswersCount}.`,
      ],
      buttonText: "OTWÓRZ KOLEJKĘ OCEN",
    },
    de: {
      heading: "Antworten warten auf Bewertung",
      paragraphs: [
        `Neue Antworten der letzten 24 Stunden: ${newAnswersCount}.`,
        `Alle Antworten in der Bewertungswarteschlange: ${pendingAnswersCount}.`,
      ],
      buttonText: "BEWERTUNGSWARTESCHLANGE ÖFFNEN",
    },
    lt: {
      heading: "Atsakymai laukia įvertinimo",
      paragraphs: [
        `Nauji atsakymai, pateikti per pastarąsias 24 valandas: ${newAnswersCount}.`,
        `Visi atsakymai vertinimo eilėje: ${pendingAnswersCount}.`,
      ],
      buttonText: "ATIDARYTI VERTINIMO EILĘ",
    },
    cs: {
      heading: "Odpovědi čekající na hodnocení",
      paragraphs: [
        `Nové odpovědi odeslané za posledních 24 hodin: ${newAnswersCount}.`,
        `Všechny odpovědi ve frontě k hodnocení: ${pendingAnswersCount}.`,
      ],
      buttonText: "OTEVŘÍT FRONTU HODNOCENÍ",
    },
    es: {
      heading: "Respuestas pendientes de revisión",
      paragraphs: [
        `Nuevas respuestas enviadas en las últimas 24 horas: ${newAnswersCount}.`,
        `Todas las respuestas en la cola de calificación: ${pendingAnswersCount}.`,
      ],
      buttonText: "ABRIR COLA DE CALIFICACIÓN",
    },
    fr: {
      heading: "Réponses en attente d’évaluation",
      paragraphs: [
        `Nouvelles réponses envoyées au cours des dernières 24 heures : ${newAnswersCount}.`,
        `Toutes les réponses dans la file d’évaluation : ${pendingAnswersCount}.`,
      ],
      buttonText: "OUVRIR LA FILE D’ÉVALUATION",
    },
  };

  return emailContent[language];
};
