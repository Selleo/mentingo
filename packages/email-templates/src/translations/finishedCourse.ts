import { EmailContent, Language } from "types";

export const getFinishedCourseEmailTranslations = (
  language: Language,
  userName: string,
  courseName: string,
) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "User finished the course",
      paragraphs: ["Hello! 🧑‍💻", `${userName} completed ${courseName}. Review their progress.`],
      buttonText: "VIEW PROGRESS",
    },
    pl: {
      heading: "Użytkownik ukończył kurs",
      paragraphs: [
        "Cześć! 🧑‍💻",
        `${userName} ukończył(-a) kurs ${courseName}. Sprawdź jego postępy.`,
      ],
      buttonText: "ZOBACZ POSTĘPY",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
