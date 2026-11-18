import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getForumMentionEmailTranslations = (
  language: SupportedLanguages,
  authorFullName: string,
  topicTitle: string,
  message: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "You were mentioned on the forum",
      paragraphs: [`${authorFullName} mentioned you in the topic "${topicTitle}":`, message],
      buttonText: "OPEN TOPIC",
    },
    pl: {
      heading: "Oznaczono Cię na forum",
      paragraphs: [`${authorFullName} oznaczył(a) Cię w temacie „${topicTitle}”:`, message],
      buttonText: "OTWÓRZ TEMAT",
    },
    de: {
      heading: "Du wurdest im Forum erwähnt",
      paragraphs: [`${authorFullName} hat dich im Thema „${topicTitle}“ erwähnt:`, message],
      buttonText: "THEMA ÖFFNEN",
    },
    lt: {
      heading: "Buvote paminėti forume",
      paragraphs: [`${authorFullName} paminėjo jus temoje „${topicTitle}“:`, message],
      buttonText: "ATIDARYTI TEMĄ",
    },
    cs: {
      heading: "Byl(a) jste zmíněn(a) ve fóru",
      paragraphs: [`${authorFullName} vás zmínil(a) v tématu „${topicTitle}“:`, message],
      buttonText: "OTEVŘÍT TÉMA",
    },
    es: {
      heading: "Te han mencionado en el foro",
      paragraphs: [`${authorFullName} te mencionó en el tema «${topicTitle}»:`, message],
      buttonText: "ABRIR TEMA",
    },
    fr: {
      heading: "Vous avez été mentionné(e) sur le forum",
      paragraphs: [
        `${authorFullName} vous a mentionné(e) dans le sujet « ${topicTitle} » :`,
        message,
      ],
      buttonText: "OUVRIR LE SUJET",
    },
  };

  return emailContent[language];
};

export const getDiscussionReplyEmailTranslations = (
  language: SupportedLanguages,
  discussionName: string,
  replyCount: string,
  replyAuthors: string,
  latestReply: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "New replies in a discussion you take part in",
      paragraphs: [
        `Discussion: ${discussionName}.`,
        `New replies: ${replyCount}. From: ${replyAuthors}.`,
        `Latest reply: ${latestReply}`,
      ],
      buttonText: "OPEN DISCUSSION",
    },
    pl: {
      heading: "Nowe odpowiedzi w dyskusji, w której bierzesz udział",
      paragraphs: [
        `Dyskusja: ${discussionName}.`,
        `Nowe odpowiedzi: ${replyCount}. Od: ${replyAuthors}.`,
        `Ostatnia odpowiedź: ${latestReply}`,
      ],
      buttonText: "OTWÓRZ DYSKUSJĘ",
    },
    de: {
      heading: "Neue Antworten in einer Diskussion, an der du teilnimmst",
      paragraphs: [
        `Diskussion: ${discussionName}.`,
        `Neue Antworten: ${replyCount}. Von: ${replyAuthors}.`,
        `Letzte Antwort: ${latestReply}`,
      ],
      buttonText: "DISKUSSION ÖFFNEN",
    },
    lt: {
      heading: "Nauji atsakymai diskusijoje, kurioje dalyvaujate",
      paragraphs: [
        `Diskusija: ${discussionName}.`,
        `Nauji atsakymai: ${replyCount}. Nuo: ${replyAuthors}.`,
        `Naujausias atsakymas: ${latestReply}`,
      ],
      buttonText: "ATIDARYTI DISKUSIJĄ",
    },
    cs: {
      heading: "Nové odpovědi v diskusi, které se účastníte",
      paragraphs: [
        `Diskuse: ${discussionName}.`,
        `Nové odpovědi: ${replyCount}. Od: ${replyAuthors}.`,
        `Poslední odpověď: ${latestReply}`,
      ],
      buttonText: "OTEVŘÍT DISKUSI",
    },
    es: {
      heading: "Nuevas respuestas en una discusión en la que participas",
      paragraphs: [
        `Discusión: ${discussionName}.`,
        `Nuevas respuestas: ${replyCount}. De: ${replyAuthors}.`,
        `Última respuesta: ${latestReply}`,
      ],
      buttonText: "ABRIR DISCUSIÓN",
    },
    fr: {
      heading: "Nouvelles réponses dans une discussion à laquelle vous participez",
      paragraphs: [
        `Discussion : ${discussionName}.`,
        `Nouvelles réponses : ${replyCount}. De : ${replyAuthors}.`,
        `Dernière réponse : ${latestReply}`,
      ],
      buttonText: "OUVRIR LA DISCUSSION",
    },
  };

  return emailContent[language];
};
