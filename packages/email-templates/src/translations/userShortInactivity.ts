import { EmailContent, Language } from "types";

export const getUserShortInactivityEmailTranslations = (language: Language, courseName: string) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Reminder",
      paragraphs: [
        "Resume learning 🔔",
        `14 days since last activity in ${courseName}. Continue to keep your progress on track.`,
      ],
      buttonText: "CONTINUE COURSE",
    },
    pl: {
      heading: "Przypomnienie",
      paragraphs: [
        "Wróć do nauki 🔔",
        `Minęło 14 dni od ostatniej aktywności w kursie ${courseName}. Kontynuuj, aby utrzymać postępy.`,
      ],
      buttonText: "KONTYNUUJ KURS",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
