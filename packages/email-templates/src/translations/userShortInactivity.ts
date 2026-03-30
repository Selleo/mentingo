import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserShortInactivityEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Erinnerung",
      paragraphs: [
        "Lerne weiter 🔔",
        `14 Tage seit der letzten Aktivität im Kurs ${courseName}. Setze fort, um deinen Fortschritt beizubehalten.`,
      ],
      buttonText: "KURS FORTSETZEN",
    },
    lt: {
      heading: "Priminimas",
      paragraphs: [
        "Pradėk mokytis iš naujo 🔔",
        `14 dienų nuo paskutinio aktyvumo kurse ${courseName}. Tęsk, kad išlaikytum savo pažangą.`,
      ],
      buttonText: "TĘSTI KURSĄ",
    },
    cs: {
      heading: "Připomenutí",
      paragraphs: [
        "Pokračuj v učení 🔔",
        `14 dní od poslední aktivity v kurzu ${courseName}. Pokračuj, abys udržel svůj pokrok.`,
      ],
      buttonText: "POKRAČOVAT V KURZU",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
