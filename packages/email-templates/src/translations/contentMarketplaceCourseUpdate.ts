import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getContentMarketplaceCourseUpdateEmailTranslations = (
  language: SupportedLanguages,
  coursesWithNewVersion: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Course updates in the content marketplace",
      paragraphs: [
        `New versions are available for: ${coursesWithNewVersion}.`,
        "Open the content marketplace and sync to get the latest version.",
      ],
      buttonText: "OPEN MARKETPLACE",
    },
    pl: {
      heading: "Aktualizacje kursów w katalogu kursów",
      paragraphs: [
        `Nowe wersje są dostępne dla: ${coursesWithNewVersion}.`,
        "Otwórz katalog kursów i zsynchronizuj, aby korzystać z najnowszej wersji.",
      ],
      buttonText: "OTWÓRZ KATALOG KURSÓW",
    },
    de: {
      heading: "Kursaktualisierungen im Marketplace",
      paragraphs: [
        `Neue Versionen sind verfügbar für: ${coursesWithNewVersion}.`,
        "Öffnen Sie den Marketplace und synchronisieren Sie, um die neueste Version zu erhalten.",
      ],
      buttonText: "MARKETPLACE ÖFFNEN",
    },
    lt: {
      heading: "Kursų atnaujinimai marketplace",
      paragraphs: [
        `Naujos versijos prieinamos: ${coursesWithNewVersion}.`,
        "Atidarykite marketplace ir sinchronizuokite, kad gautumėte naujausią versiją.",
      ],
      buttonText: "ATIDARYTI MARKETPLACE",
    },
    cs: {
      heading: "Aktualizace kurzů v marketplace",
      paragraphs: [
        `Nové verze jsou k dispozici pro: ${coursesWithNewVersion}.`,
        "Otevřete marketplace a synchronizujte, abyste získali nejnovější verzi.",
      ],
      buttonText: "OTEVŘÍT MARKETPLACE",
    },
    es: {
      heading: "Actualizaciones de cursos en el marketplace",
      paragraphs: [
        `Hay nuevas versiones disponibles de: ${coursesWithNewVersion}.`,
        "Abre el marketplace y sincroniza para obtener la versión más reciente.",
      ],
      buttonText: "ABRIR MARKETPLACE",
    },
    fr: {
      heading: "Mises à jour de cours dans le marketplace",
      paragraphs: [
        `De nouvelles versions sont disponibles pour : ${coursesWithNewVersion}.`,
        "Ouvrez le marketplace et synchronisez pour obtenir la dernière version.",
      ],
      buttonText: "OUVRIR LE MARKETPLACE",
    },
  };

  return emailContent[language];
};
