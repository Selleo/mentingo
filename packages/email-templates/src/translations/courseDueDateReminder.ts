import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

const getDaysLabel = (language: SupportedLanguages, daysBeforeDueDate: number) => {
  const normalizedDaysBeforeDueDate = Number(daysBeforeDueDate);

  if (Number.isNaN(normalizedDaysBeforeDueDate)) {
    const labels: Record<SupportedLanguages, string> = {
      en: "soon",
      pl: "wkrótce",
      de: "bald",
      lt: "netrukus",
      cs: "brzy",
    };

    return labels[language] ?? labels.en;
  }

  if (normalizedDaysBeforeDueDate === 1) {
    const labels: Record<SupportedLanguages, string> = {
      en: "tomorrow",
      pl: "jutro",
      de: "morgen",
      lt: "rytoj",
      cs: "zítra",
    };

    return labels[language] ?? labels.en;
  }

  if (normalizedDaysBeforeDueDate === 0) {
    const labels: Record<SupportedLanguages, string> = {
      en: "today",
      pl: "dziś",
      de: "heute",
      lt: "šiandien",
      cs: "dnes",
    };

    return labels[language] ?? labels.en;
  }

  const labels: Record<SupportedLanguages, string> = {
    en: `in ${normalizedDaysBeforeDueDate} days`,
    pl: `za ${normalizedDaysBeforeDueDate} ${normalizedDaysBeforeDueDate === 1 ? "dzień" : "dni"}`,
    de: `in ${daysBeforeDueDate} Tagen`,
    lt: `po ${daysBeforeDueDate} dienų`,
    cs: `za ${daysBeforeDueDate} dní`,
  };

  return labels[language] ?? labels.en;
};

export const getCourseDueDateReminderEmailTranslations = (
  language: SupportedLanguages,
  courseName: string,
  _dueDate: string,
  daysBeforeDueDate: number,
) => {
  const daysLabel = getDaysLabel(language, daysBeforeDueDate);

  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Course deadline approaching",
      paragraphs: [`The deadline to complete course "${courseName}" is ${daysLabel}.`],
      buttonText: "OPEN COURSE",
    },
    pl: {
      heading: "Zbliża się termin kursu",
      paragraphs: [`Termin ukończenia kursu "${courseName}" mija ${daysLabel}.`],
      buttonText: "OTWÓRZ KURS",
    },
    de: {
      heading: "Kursfrist naht",
      paragraphs: [`Die Frist zum Abschluss des Kurses "${courseName}" endet ${daysLabel}.`],
      buttonText: "KURS ÖFFNEN",
    },
    lt: {
      heading: "Artėja kurso terminas",
      paragraphs: [`Kurso "${courseName}" užbaigimo terminas baigiasi ${daysLabel}.`],
      buttonText: "ATIDARYTI KURSĄ",
    },
    cs: {
      heading: "Termín kurzu se blíží",
      paragraphs: [`Termín dokončení kurzu "${courseName}" vyprší ${daysLabel}.`],
      buttonText: "OTEVŘÍT KURZ",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
