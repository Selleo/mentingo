import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getCertificateExpirationWarningEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
  expiresAt: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Certificate expires soon",
      paragraphs: [
        `Your certificate for ${courseName} expires on ${expiresAt}.`,
        "After expiry, your course progress will reset and you will need to complete the course again to receive a new certificate.",
      ],
      buttonText: "OPEN COURSE",
    },
    pl: {
      heading: "Certyfikat wkrótce wygaśnie",
      paragraphs: [
        `Twój certyfikat z kursu ${courseName} wygaśnie ${expiresAt}.`,
        "Po wygaśnięciu postęp kursu zostanie zresetowany. Aby otrzymać nowy certyfikat, ukończ kurs ponownie.",
      ],
      buttonText: "PRZEJDŹ DO KURSU",
    },
    de: {
      heading: "Zertifikat läuft bald ab",
      paragraphs: [
        `Dein Zertifikat für ${courseName} läuft am ${expiresAt} ab.`,
        "Nach Ablauf wird dein Kursfortschritt zurückgesetzt. Schließe den Kurs erneut ab, um ein neues Zertifikat zu erhalten.",
      ],
      buttonText: "KURS ÖFFNEN",
    },
    lt: {
      heading: "Pažymėjimas netrukus baigs galioti",
      paragraphs: [
        `Tavo kurso ${courseName} pažymėjimas baigs galioti ${expiresAt}.`,
        "Pasibaigus galiojimui, kurso pažanga bus nustatyta iš naujo. Norint gauti naują pažymėjimą, kursą reikės baigti dar kartą.",
      ],
      buttonText: "ATIDARYTI KURSĄ",
    },
    cs: {
      heading: "Certifikát brzy vyprší",
      paragraphs: [
        `Tvůj certifikát ke kurzu ${courseName} vyprší ${expiresAt}.`,
        "Po vypršení bude průběh kurzu resetován. Pro získání nového certifikátu kurz dokonči znovu.",
      ],
      buttonText: "OTEVŘÍT KURZ",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
