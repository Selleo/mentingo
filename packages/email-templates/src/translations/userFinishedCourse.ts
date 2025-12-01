import { EmailContent, Language } from "types";

export const getUserFinishedCourseEmailTranslations = (language: Language, courseName: string) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Course completed",
      paragraphs: [
        "Congratulations! 🏁",
        `You've completed ${courseName}. Your certificate is ready to download; check the recommended next steps.`,
      ],
      buttonText: "DOWNLOAD CERTIFICATE",
    },
    pl: {
      heading: "Kurs ukończony",
      paragraphs: [
        "Gratulacje! 🏁",
        `Ukończyłeś(-aś) ${courseName}. Certyfikat jest gotowy do pobrania; sprawdź też proponowane ścieżki dalszej nauki.`,
      ],
      buttonText: "POBIERZ CERTYFIKAT",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
