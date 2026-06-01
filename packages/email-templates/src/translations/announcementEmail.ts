import { EmailContent } from "types";

import type { SupportedLanguages } from "@repo/shared";

export const getAnnouncementEmailTranslations = (
  language: SupportedLanguages,
  title: string,
  content: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: title,
      paragraphs: [content],
      buttonText: "Open notifications",
    },
    pl: {
      heading: title,
      paragraphs: [content],
      buttonText: "Otwórz powiadomienia",
    },
    de: {
      heading: title,
      paragraphs: [content],
      buttonText: "Benachrichtigungen öffnen",
    },
    lt: {
      heading: title,
      paragraphs: [content],
      buttonText: "Atidaryti pranešimus",
    },
    cs: {
      heading: title,
      paragraphs: [content],
      buttonText: "Otevřít oznámení",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
