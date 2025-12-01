import { EmailContent, Language } from "types";

export const getUserFinishedChapterEmailTranslations = (
  language: Language,
  chapterName: string,
  courseName: string,
) => {
  const emailContent: Record<Language, EmailContent> = {
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
  };

  return emailContent[language] ?? emailContent.en;
};
