import { EmailContent, Language } from "types";

export const getUserFinishedCourseEmailTranslations = (
  language: Language,
  courseName: string,
  hasCertificate: boolean,
) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Course completed",
      paragraphs: [
        "Congratulations! 🏁",
        `You've completed ${courseName}. ${hasCertificate ? "Your certificate is ready to download; check the recommended next steps." : ""}`,
      ],
      buttonText: hasCertificate ? "DOWNLOAD CERTIFICATE" : "CONTINUE LEARNING",
    },
    pl: {
      heading: "Kurs ukończony",
      paragraphs: [
        "Gratulacje! 🏁",
        `Ukończyłeś(-aś) ${courseName}. ${hasCertificate ? "Certyfikat jest gotowy do pobrania; sprawdź też proponowane ścieżki dalszej nauki." : ""}`,
      ],
      buttonText: hasCertificate ? "POBIERZ CERTYFIKAT" : "KONTYNUUJ SWOJĄ NAUKĘ",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
