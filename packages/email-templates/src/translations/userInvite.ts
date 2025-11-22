import { EmailContent, Language } from "types";

export const getUserInviteEmailTranslations = (language: Language, invitedByUserName: string) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "You're invited",
      paragraphs: [
        "Hello there 👋",
        `You've been invited to the e-learning platform by ${invitedByUserName}. Click the button below to start improving your skills.`,
      ],
      buttonText: "JOIN NOW",
    },
    pl: {
      heading: "Zaproszenie",
      paragraphs: [
        "Cześć! 👋",
        `Zostałeś(-aś) zaproszony(-a) na platformę e-learningową przez ${invitedByUserName}. Kliknij przycisk poniżej, aby rozpocząć naukę.`,
      ],
      buttonText: "DOŁĄCZ TERAZ",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
