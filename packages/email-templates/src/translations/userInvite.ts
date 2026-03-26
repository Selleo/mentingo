import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserInviteEmailTranslations = (
  language: SupportedLanguages,
  invitedByUserName: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Du bist eingeladen",
      paragraphs: [
        "Hallo 👋",
        `Du wurdest von ${invitedByUserName} zur E-Learning-Plattform eingeladen. Klicke auf die Schaltfläche unten, um mit dem Lernen zu beginnen.`,
      ],
      buttonText: "JETZT BEITRETEN",
    },
    lt: {
      heading: "Esi pakviestas",
      paragraphs: [
        "Sveiki 👋",
        `Tave į e. mokymosi platformą pakvietė ${invitedByUserName}. Paspausk mygtuką žemiau ir pradėk tobulinti įgūdžius.`,
      ],
      buttonText: "PRISIJUNGTI DABAR",
    },
    cs: {
      heading: "Jsi pozván(a)",
      paragraphs: [
        "Ahoj 👋",
        `Na e-learningovou platformu tě pozval(a) ${invitedByUserName}. Klikni na tlačítko níže a začni zlepšovat své dovednosti.`,
      ],
      buttonText: "PŘIPOJIT SE NYNÍ",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
