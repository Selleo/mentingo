import { EmailContent, Language } from "types";

export const getMagicLinkEmailTranslations = (language: Language) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Magic Link",
      paragraphs: [
        "You have received a magic link to your account. Click the button below to open it.",
      ],
      buttonText: "OPEN MAGIC LINK",
    },
    pl: {
      heading: "Magiczny Link",
      paragraphs: [
        "Otrzymałeś magiczny link do swojego konta. Kliknij przycisk poniżej, aby otworzyć go.",
      ],
      buttonText: "OTWÓRZ MAGICZNY LINK",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
