import { SupportedLanguages } from "@repo/shared";
import { EmailContent, EmailContentLink } from "types";

const UNSUBSCRIBE_LINK_TEXTS: Record<
  SupportedLanguages,
  { mentions: string; replies: string; thread: string }
> = {
  en: {
    mentions: "Turn off emails about mentions",
    replies: "Turn off emails about replies",
    thread: "Stop following this discussion",
  },
  pl: {
    mentions: "Wyłącz e-maile o wzmiankach",
    replies: "Wyłącz e-maile o odpowiedziach",
    thread: "Przestań obserwować tę dyskusję",
  },
  de: {
    mentions: "E-Mails über Erwähnungen deaktivieren",
    replies: "E-Mails über Antworten deaktivieren",
    thread: "Dieser Diskussion nicht mehr folgen",
  },
  lt: {
    mentions: "Išjungti el. laiškus apie paminėjimus",
    replies: "Išjungti el. laiškus apie atsakymus",
    thread: "Nebesekti šios diskusijos",
  },
  cs: {
    mentions: "Vypnout e-maily o zmínkách",
    replies: "Vypnout e-maily o odpovědích",
    thread: "Přestat sledovat tuto diskusi",
  },
  es: {
    mentions: "Desactivar los correos sobre menciones",
    replies: "Desactivar los correos sobre respuestas",
    thread: "Dejar de seguir esta discusión",
  },
  fr: {
    mentions: "Désactiver les e-mails sur les mentions",
    replies: "Désactiver les e-mails sur les réponses",
    thread: "Ne plus suivre cette discussion",
  },
};

export const getMentionUnsubscribeEmailLinks = (
  language: SupportedLanguages,
  unsubscribeUrl: string,
): EmailContentLink[] => [{ text: UNSUBSCRIBE_LINK_TEXTS[language].mentions, url: unsubscribeUrl }];

export const getReplyUnsubscribeEmailLinks = (
  language: SupportedLanguages,
  unfollowUrl: string,
  unsubscribeUrl: string,
): EmailContentLink[] => [
  { text: UNSUBSCRIBE_LINK_TEXTS[language].thread, url: unfollowUrl },
  { text: UNSUBSCRIBE_LINK_TEXTS[language].replies, url: unsubscribeUrl },
];

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
