import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserLongInactivityEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Zeit, zu deinem Kurs zurückzukehren",
      paragraphs: [
        "Lerne weiter 📚",
        `Seit deiner letzten Aktivität in ${courseName} sind 30 Tage vergangen. Wenn du jetzt weitermachst, schließt du den Kurs leichter rechtzeitig ab.`,
      ],
      buttonText: "KURS FORTSETZEN",
    },
    lt: {
      heading: "Laikas grįžti į kursą",
      paragraphs: [
        "Tęsk mokymąsi 📚",
        `Nuo paskutinės tavo veiklos kurse ${courseName} praėjo 30 dienų. Tęsiant dabar, bus lengviau baigti programą laiku.`,
      ],
      buttonText: "TĘSTI KURSĄ",
    },
    cs: {
      heading: "Je čas vrátit se ke kurzu",
      paragraphs: [
        "Pokračuj ve studiu 📚",
        `Od tvé poslední aktivity v kurzu ${courseName} uběhlo 30 dní. Když se vrátíš teď, snáz ho dokončíš včas.`,
      ],
      buttonText: "POKRAČOVAT V KURZU",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
