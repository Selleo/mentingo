import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getFinishedCourseEmailTranslations = (
  language: SupportedLanguages,
  userName: string,
  courseName: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Benutzer hat den Kurs abgeschlossen",
      paragraphs: [
        "Hallo! 🧑‍💻",
        `${userName} hat ${courseName} abgeschlossen. Prüfe den Fortschritt.`,
      ],
      buttonText: "FORTSCHRITT ANSEHEN",
    },
    lt: {
      heading: "Naudotojas baigė kursą",
      paragraphs: ["Sveiki! 🧑‍💻", `${userName} baigė kursą ${courseName}. Peržiūrėk pažangą.`],
      buttonText: "PERŽIŪRĖTI PAŽANGĄ",
    },
    cs: {
      heading: "Uživatel dokončil kurz",
      paragraphs: [
        "Ahoj! 🧑‍💻",
        `${userName} dokončil(a) kurz ${courseName}. Zkontroluj jeho pokrok.`,
      ],
      buttonText: "ZOBRAZIT POKROK",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
