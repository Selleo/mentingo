import { EmailContent, Language } from "types";

export const getPasswordRecoveryEmailTranslations = (language: Language, name: string) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Password Recovery",
      paragraphs: [
        `Hey ${name}, you've requested a password reset 🔑`,
        "You can reset your password using the button below.",
      ],
      buttonText: "RESET PASSWORD",
    },
    pl: {
      heading: "Odzyskiwanie hasła",
      paragraphs: [
        `Cześć ${name}, poprosiłeś(-aś) o reset hasła 🔑`,
        "Możesz zresetować swoje hasło, klikając przycisk poniżej.",
      ],
      buttonText: "ZRESETUJ HASŁO",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
