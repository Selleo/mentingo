import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getUserFinishedChapterEmailTranslations = (
  language: SupportedLanguages,
  chapterName: string,
  courseName: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Chapter completed",
      paragraphs: [
        "Progress updated 🧩",
        `You've finished ${chapterName} in ${courseName}. The next materials are ready.`,
      ],
      buttonText: "NEXT CHAPTER",
    },
    pl: {
      heading: "Rozdział ukończony",
      paragraphs: [
        "Postęp zaktualizowany 🧩",
        `Ukończyłeś(-aś) ${chapterName} w kursie ${courseName}. Kolejne materiały są już dostępne.`,
      ],
      buttonText: "NASTĘPNY ROZDZIAŁ",
    },
    de: {
      heading: "Kapitel abgeschlossen",
      paragraphs: [
        "Fortschritt aktualisiert 🧩",
        `Du hast ${chapterName} in ${courseName} abgeschlossen. Die nächsten Materialien sind bereit.`,
      ],
      buttonText: "NÄCHSTES KAPITEL",
    },
    lt: {
      heading: "Skyrius baigtas",
      paragraphs: [
        "Pažanga atnaujinta 🧩",
        `Baigei ${chapterName} kurse ${courseName}. Kitos medžiagos jau paruoštos.`,
      ],
      buttonText: "KITAS SKYRIUS",
    },
    cs: {
      heading: "Kapitola dokončena",
      paragraphs: [
        "Pokrok aktualizován 🧩",
        `Dokončil(a) jsi ${chapterName} v kurzu ${courseName}. Další materiály jsou připraveny.`,
      ],
      buttonText: "DALŠÍ KAPITOLA",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
