import type { SupportedLanguages } from "@repo/shared";

export const getCourseChatMentionEmailHeading = (language: SupportedLanguages) =>
  (
    ({
      en: "You were mentioned in course chat",
      pl: "Oznaczono Cię na czacie kursu",
      de: "Du wurdest im Kurschat erwähnt",
      lt: "Buvote paminėti kurso pokalbyje",
      cs: "Byl(a) jste zmíněn(a) v chatu kurzu",
      es: "Te han mencionado en el chat del curso",
    }) satisfies Record<SupportedLanguages, string>
  )[language];

export const getCourseChatMentionEmailButtonText = (language: SupportedLanguages) =>
  (
    ({
      en: "Open course discussion",
      pl: "Otwórz dyskusję kursu",
      de: "Kursdiskussion öffnen",
      lt: "Atidaryti kurso diskusiją",
      cs: "Otevřít diskuzi kurzu",
      es: "Abrir debate del curso",
    }) satisfies Record<SupportedLanguages, string>
  )[language];

export const getCourseChatMentionEmailParagraphs = (
  language: SupportedLanguages,
  params: {
    recipientName: string;
    authorName: string;
    courseName: string;
    messageContent: string;
  },
) => {
  const translations = {
    en: [
      `Hi ${params.recipientName}, ${params.authorName} mentioned you in ${params.courseName}.`,
      `"${params.messageContent}"`,
    ],
    pl: [
      `Cześć ${params.recipientName}, ${params.authorName} oznaczył(a) Cię w kursie ${params.courseName}.`,
      `"${params.messageContent}"`,
    ],
    de: [
      `Hallo ${params.recipientName}, ${params.authorName} hat dich in ${params.courseName} erwähnt.`,
      `"${params.messageContent}"`,
    ],
    lt: [
      `Sveiki, ${params.recipientName}, ${params.authorName} paminėjo jus kurse ${params.courseName}.`,
      `"${params.messageContent}"`,
    ],
    cs: [
      `Ahoj ${params.recipientName}, ${params.authorName} vás zmínil(a) v kurzu ${params.courseName}.`,
      `"${params.messageContent}"`,
    ],
    es: [
      `Hola ${params.recipientName}, ${params.authorName} te ha mencionado en ${params.courseName}.`,
      `"${params.messageContent}"`,
    ],
  } satisfies Record<SupportedLanguages, string[]>;

  return translations[language];
};
