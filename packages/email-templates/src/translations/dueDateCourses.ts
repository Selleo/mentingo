import { COURSE_DUE_DATE_AT_RISK_DAYS, type SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export type DueDateCourse = {
  courseTitle: string;
  learnersCount: number;
};

const DUE_DATE_COURSES_NAMING = {
  NAMED_COURSES: 2,
  MIN_SUMMARIZED_COURSES: 2,
} as const;

type DueDateCoursesCopy = {
  overdue: (courses: string) => EmailContent;
  atRisk: (courses: string, dueWithinDays: number) => EmailContent;
  remainingCourses: (remainingCount: number) => string;
};

const DUE_DATE_COURSES_COPY: Record<SupportedLanguages, DueDateCoursesCopy> = {
  en: {
    overdue: (courses) => ({
      heading: "Courses past their due date",
      paragraphs: [
        `Some learners did not finish ${courses} by the due date.`,
        "Open the report to see who still needs to finish.",
      ],
      buttonText: "VIEW REPORT",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Course due dates are approaching",
      paragraphs: [
        `Some learners have not finished ${courses} yet, and the due date is in ${dueWithinDays} days.`,
        "Open the report to see who still needs to finish.",
      ],
      buttonText: "VIEW REPORT",
    }),
    remainingCourses: (remainingCount) => `${remainingCount} more`,
  },
  pl: {
    overdue: (courses) => ({
      heading: "Kursy po terminie",
      paragraphs: [
        `Niektórzy uczestnicy nie ukończyli w terminie: ${courses}.`,
        "Otwórz raport, aby sprawdzić, kto musi jeszcze ukończyć kurs.",
      ],
      buttonText: "ZOBACZ RAPORT",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Zbliżają się terminy kursów",
      paragraphs: [
        `Niektórzy uczestnicy nie ukończyli jeszcze: ${courses}, a termin upływa za ${dueWithinDays} dni.`,
        "Otwórz raport, aby sprawdzić, kto musi jeszcze ukończyć kurs.",
      ],
      buttonText: "ZOBACZ RAPORT",
    }),
    remainingCourses: (remainingCount) => `jeszcze ${remainingCount}`,
  },
  de: {
    overdue: (courses) => ({
      heading: "Kurse nach Ablauf der Frist",
      paragraphs: [
        `Einige Teilnehmende haben ${courses} nicht fristgerecht abgeschlossen.`,
        "Öffnen Sie den Bericht, um zu sehen, wer noch abschließen muss.",
      ],
      buttonText: "BERICHT ANZEIGEN",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Kursfristen rücken näher",
      paragraphs: [
        `Einige Teilnehmende haben ${courses} noch nicht abgeschlossen, und die Frist endet in ${dueWithinDays} Tagen.`,
        "Öffnen Sie den Bericht, um zu sehen, wer noch abschließen muss.",
      ],
      buttonText: "BERICHT ANZEIGEN",
    }),
    remainingCourses: (remainingCount) => `${remainingCount} weitere`,
  },
  lt: {
    overdue: (courses) => ({
      heading: "Kursai po termino",
      paragraphs: [
        `Kai kurie studentai laiku nebaigė šių kursų: ${courses}.`,
        "Atidarykite ataskaitą, kad pamatytumėte, kam dar reikia baigti.",
      ],
      buttonText: "PERŽIŪRĖTI ATASKAITĄ",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Artėja kursų terminai",
      paragraphs: [
        `Kai kurie studentai dar nebaigė šių kursų: ${courses}, o terminas baigiasi po ${dueWithinDays} dienų.`,
        "Atidarykite ataskaitą, kad pamatytumėte, kam dar reikia baigti.",
      ],
      buttonText: "PERŽIŪRĖTI ATASKAITĄ",
    }),
    remainingCourses: (remainingCount) => `dar ${remainingCount}`,
  },
  cs: {
    overdue: (courses) => ({
      heading: "Kurzy po termínu",
      paragraphs: [
        `Někteří studenti nedokončili v termínu tyto kurzy: ${courses}.`,
        "Otevřete přehled a zjistěte, kdo ještě musí kurz dokončit.",
      ],
      buttonText: "ZOBRAZIT PŘEHLED",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Blíží se termíny kurzů",
      paragraphs: [
        `Někteří studenti ještě nedokončili tyto kurzy: ${courses}, a termín vyprší za ${dueWithinDays} dní.`,
        "Otevřete přehled a zjistěte, kdo ještě musí kurz dokončit.",
      ],
      buttonText: "ZOBRAZIT PŘEHLED",
    }),
    remainingCourses: (remainingCount) => `ještě ${remainingCount}`,
  },
  es: {
    overdue: (courses) => ({
      heading: "Cursos con la fecha límite vencida",
      paragraphs: [
        `Algunos estudiantes no completaron ${courses} antes de la fecha límite.`,
        "Abre el informe para ver quién aún tiene que terminar.",
      ],
      buttonText: "VER INFORME",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Se acercan las fechas límite de los cursos",
      paragraphs: [
        `Algunos estudiantes aún no han completado ${courses}, y la fecha límite vence en ${dueWithinDays} días.`,
        "Abre el informe para ver quién aún tiene que terminar.",
      ],
      buttonText: "VER INFORME",
    }),
    remainingCourses: (remainingCount) => `${remainingCount} más`,
  },
  fr: {
    overdue: (courses) => ({
      heading: "Cours dont la date limite est dépassée",
      paragraphs: [
        `Certains apprenants n'ont pas terminé ${courses} avant la date limite.`,
        "Ouvrez le rapport pour voir qui doit encore terminer.",
      ],
      buttonText: "VOIR LE RAPPORT",
    }),
    atRisk: (courses, dueWithinDays) => ({
      heading: "Les dates limites des cours approchent",
      paragraphs: [
        `Certains apprenants n'ont pas encore terminé ${courses}, et la date limite arrive dans ${dueWithinDays} jours.`,
        "Ouvrez le rapport pour voir qui doit encore terminer.",
      ],
      buttonText: "VOIR LE RAPPORT",
    }),
    remainingCourses: (remainingCount) => `${remainingCount} autres`,
  },
};

/** Names the courses with the most unfinished learners, counting the rest once at least two would be left over. */
export const summarizeDueDateCourseTitles = (
  courses: DueDateCourse[],
  language: SupportedLanguages,
) => {
  const listFormat = new Intl.ListFormat(language, { type: "conjunction" });
  const courseTitles = [...courses]
    .sort(
      (firstCourse, secondCourse) =>
        secondCourse.learnersCount - firstCourse.learnersCount ||
        firstCourse.courseTitle.localeCompare(secondCourse.courseTitle, language),
    )
    .map(({ courseTitle }) => courseTitle);
  const remainingCount = courseTitles.length - DUE_DATE_COURSES_NAMING.NAMED_COURSES;

  if (remainingCount < DUE_DATE_COURSES_NAMING.MIN_SUMMARIZED_COURSES)
    return listFormat.format(courseTitles);

  return listFormat.format([
    ...courseTitles.slice(0, DUE_DATE_COURSES_NAMING.NAMED_COURSES),
    DUE_DATE_COURSES_COPY[language].remainingCourses(remainingCount),
  ]);
};

export const getOverdueCoursesEmailTranslations = (language: SupportedLanguages, courses: string) =>
  DUE_DATE_COURSES_COPY[language].overdue(courses);

export const getCourseDueDatesAtRiskEmailTranslations = (
  language: SupportedLanguages,
  courses: string,
) => DUE_DATE_COURSES_COPY[language].atRisk(courses, COURSE_DUE_DATE_AT_RISK_DAYS);
