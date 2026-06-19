import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserShortInactivityEmailTranslations = (
  language: SupportedLanguages,
  courseName?: string,
) => {
  const activityContext: Record<SupportedLanguages, string> = {
    en: courseName ? `in ${courseName}` : "on platform",
    pl: courseName ? `w kursie ${courseName}` : "na platformie",
    de: courseName ? `im Kurs ${courseName}` : "auf der Plattform",
    lt: courseName ? `kurse ${courseName}` : "platformoje",
    cs: courseName ? `v kurzu ${courseName}` : "na platformě",
  };

  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Reminder",
      paragraphs: [
        "Resume learning 🔔",
        `14 days since last activity ${activityContext.en}. Continue to keep your progress on track.`,
      ],
      buttonText: courseName ? "CONTINUE COURSE" : "OPEN PLATFORM",
    },
    pl: {
      heading: "Przypomnienie",
      paragraphs: [
        "Wróć do nauki 🔔",
        `Minęło 14 dni od ostatniej aktywności ${activityContext.pl}. Kontynuuj, aby utrzymać postępy.`,
      ],
      buttonText: courseName ? "KONTYNUUJ KURS" : "OTWÓRZ PLATFORMĘ",
    },
    de: {
      heading: "Erinnerung",
      paragraphs: [
        "Lerne weiter 🔔",
        `14 Tage seit der letzten Aktivität ${activityContext.de}. Setze fort, um deinen Fortschritt beizubehalten.`,
      ],
      buttonText: courseName ? "KURS FORTSETZEN" : "PLATTFORM ÖFFNEN",
    },
    lt: {
      heading: "Priminimas",
      paragraphs: [
        "Pradėk mokytis iš naujo 🔔",
        `14 dienų nuo paskutinio aktyvumo ${activityContext.lt}. Tęsk, kad išlaikytum savo pažangą.`,
      ],
      buttonText: courseName ? "TĘSTI KURSĄ" : "ATIDARYTI PLATFORMĄ",
    },
    cs: {
      heading: "Připomenutí",
      paragraphs: [
        "Pokračuj v učení 🔔",
        `14 dní od poslední aktivity ${activityContext.cs}. Pokračuj, abys udržel svůj pokrok.`,
      ],
      buttonText: courseName ? "POKRAČOVAT V KURZU" : "OTEVŘÍT PLATFORMU",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
