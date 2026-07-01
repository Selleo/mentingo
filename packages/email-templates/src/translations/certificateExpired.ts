import { CERTIFICATE_ARCHIVE_REASONS } from "@repo/shared";
import { EmailContent } from "types";

import type { CertificateArchiveReason, SupportedLanguages } from "@repo/shared";

export const getCertificateExpiredEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
  reason: CertificateArchiveReason,
) => {
  const isManualReset = reason === CERTIFICATE_ARCHIVE_REASONS.MANUAL_RESET;

  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: isManualReset ? "Certificate reset" : "Certificate expired",
      paragraphs: [
        isManualReset
          ? `Your certificate for ${courseName} has been reset by an administrator.`
          : `Your certificate for ${courseName} has expired.`,
        "The certificate was archived and your course progress was reset. Complete the course again to receive a new certificate.",
      ],
      buttonText: "OPEN COURSE",
    },
    pl: {
      heading: isManualReset ? "Certyfikat zresetowany" : "Certyfikat wygasł",
      paragraphs: [
        isManualReset
          ? `Administrator zresetował Twój certyfikat z kursu ${courseName}.`
          : `Twój certyfikat z kursu ${courseName} wygasł.`,
        "Certyfikat został zarchiwizowany, a postęp kursu zresetowany. Ukończ kurs ponownie, aby otrzymać nowy certyfikat.",
      ],
      buttonText: "PRZEJDŹ DO KURSU",
    },
    de: {
      heading: isManualReset ? "Zertifikat zurückgesetzt" : "Zertifikat abgelaufen",
      paragraphs: [
        isManualReset
          ? `Dein Zertifikat für ${courseName} wurde von einem Administrator zurückgesetzt.`
          : `Dein Zertifikat für ${courseName} ist abgelaufen.`,
        "Das Zertifikat wurde archiviert und dein Kursfortschritt zurückgesetzt. Schließe den Kurs erneut ab, um ein neues Zertifikat zu erhalten.",
      ],
      buttonText: "KURS ÖFFNEN",
    },
    lt: {
      heading: isManualReset ? "Pažymėjimas nustatytas iš naujo" : "Pažymėjimas nebegalioja",
      paragraphs: [
        isManualReset
          ? `Administratorius iš naujo nustatė tavo kurso ${courseName} pažymėjimą.`
          : `Tavo kurso ${courseName} pažymėjimas nebegalioja.`,
        "Pažymėjimas buvo suarchyvuotas, o kurso pažanga nustatyta iš naujo. Baik kursą dar kartą, kad gautum naują pažymėjimą.",
      ],
      buttonText: "ATIDARYTI KURSĄ",
    },
    cs: {
      heading: isManualReset ? "Certifikát resetován" : "Certifikát vypršel",
      paragraphs: [
        isManualReset
          ? `Administrátor resetoval tvůj certifikát ke kurzu ${courseName}.`
          : `Tvůj certifikát ke kurzu ${courseName} vypršel.`,
        "Certifikát byl archivován a průběh kurzu resetován. Pro získání nového certifikátu kurz dokonči znovu.",
      ],
      buttonText: "OTEVŘÍT KURZ",
    },
    es: {
      heading: isManualReset ? "Certificado restablecido" : "Certificado caducado",
      paragraphs: [
        isManualReset
          ? `Un administrador ha restablecido tu certificado del curso ${courseName}.`
          : `Tu certificado del curso ${courseName} ha caducado.`,
        "El certificado se ha archivado y el progreso del curso se ha restablecido. Completa el curso de nuevo para recibir un certificado nuevo.",
      ],
      buttonText: "ABRIR CURSO",
    },
  };

  return emailContent[language];
};
