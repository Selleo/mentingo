import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserFinishedCourseEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
  hasCertificate: boolean,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Kurs abgeschlossen",
      paragraphs: [
        "Herzlichen Glückwunsch! 🏁",
        `Du hast ${courseName} abgeschlossen. ${hasCertificate ? "Dein Zertifikat steht zum Download bereit; prüfe auch die empfohlenen nächsten Lernschritte." : ""}`,
      ],
      buttonText: hasCertificate ? "ZERTIFIKAT HERUNTERLADEN" : "WEITERLERNEN",
    },
    lt: {
      heading: "Kursas baigtas",
      paragraphs: [
        "Sveikiname! 🏁",
        `Baigei ${courseName}. ${hasCertificate ? "Tavo pažymėjimas paruoštas atsisiuntimui; peržiūrėk ir rekomenduojamus tolesnius mokymosi žingsnius." : ""}`,
      ],
      buttonText: hasCertificate ? "ATSIŲSTI PAŽYMĖJIMĄ" : "TĘSTI MOKYMĄSI",
    },
    cs: {
      heading: "Kurz dokončen",
      paragraphs: [
        "Gratulujeme! 🏁",
        `Dokončil(a) jsi ${courseName}. ${hasCertificate ? "Tvůj certifikát je připraven ke stažení; podívej se také na doporučené další kroky." : ""}`,
      ],
      buttonText: hasCertificate ? "STÁHNOUT CERTIFIKÁT" : "POKRAČOVAT VE STUDIU",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
