import { EmailContent, Language } from "types";

export const getUserLongInactivityEmailTranslations = (language: Language, courseName: string) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Time to resume your course",
      paragraphs: [
        "Continue learning 📚",
        `It's been 30 days since your last activity in ${courseName}. Resuming now will help you finish on time.`,
      ],
      buttonText: "RESUME COURSE",
    },
    pl: {
      heading: "Czas wrócić do kursu",
      paragraphs: [
        "Kontynuuj naukę 📚",
        `Minęło 30 dni od Twojej ostatniej aktywności w kursie ${courseName}. Wznowienie teraz ułatwi ukończenie programu.`,
      ],
      buttonText: "WZNÓW KURS",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
