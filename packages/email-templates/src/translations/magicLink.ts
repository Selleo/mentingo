import { EmailContent, Language } from "types";

export const getMagicLinkEmailTranslations = (language: Language) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Login Link",
      paragraphs: [
        "You have received a login link to your account. Click the button below to open it.",
      ],
      buttonText: "OPEN LOGIN LINK",
    },
    pl: {
      heading: "Link do logowania",
      paragraphs: [
        "Otrzymałeś link do logowania do swojego konta. Kliknij przycisk poniżej, aby go otworzyć.",
      ],
      buttonText: "OTWÓRZ LINK DO LOGOWANIA",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
