import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserLongInactivityEmailTranslations = (
  language: SupportedLanguages,
  courseName?: string,
) => {
  const activityContext: Record<SupportedLanguages, string> = {
    en: courseName ? `in ${courseName}` : "on platform",
    pl: courseName ? `w kursie ${courseName}` : "na platformie",
    de: courseName ? `in ${courseName}` : "auf der Plattform",
    lt: courseName ? `kurse ${courseName}` : "platformoje",
    cs: courseName ? `v kurzu ${courseName}` : "na platformě",
  };

  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Time to resume your course",
      paragraphs: [
        "Continue learning 📚",
        `It's been 30 days since your last activity ${activityContext.en}. Resuming now will help you finish on time.`,
      ],
      buttonText: "RESUME COURSE",
    },
    pl: {
      heading: "Czas wrócić do kursu",
      paragraphs: [
        "Kontynuuj naukę 📚",
        `Minęło 30 dni od Twojej ostatniej aktywności ${activityContext.pl}. Wznowienie teraz ułatwi ukończenie programu.`,
      ],
      buttonText: "WZNÓW KURS",
    },
    de: {
      heading: "Zeit, zu deinem Kurs zurückzukehren",
      paragraphs: [
        "Lerne weiter 📚",
        `Seit deiner letzten Aktivität ${activityContext.de} sind 30 Tage vergangen. Wenn du jetzt weitermachst, schließt du den Kurs leichter rechtzeitig ab.`,
      ],
      buttonText: "KURS FORTSETZEN",
    },
    lt: {
      heading: "Laikas grįžti į kursą",
      paragraphs: [
        "Tęsk mokymąsi 📚",
        `Nuo paskutinės tavo veiklos ${activityContext.lt} praėjo 30 dienų. Tęsiant dabar, bus lengviau baigti programą laiku.`,
      ],
      buttonText: "TĘSTI KURSĄ",
    },
    cs: {
      heading: "Je čas vrátit se ke kurzu",
      paragraphs: [
        "Pokračuj ve studiu 📚",
        `Od tvé poslední aktivity ${activityContext.cs} uběhlo 30 dní. Když se vrátíš teď, snáz ho dokončíš včas.`,
      ],
      buttonText: "POKRAČOVAT V KURZU",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
