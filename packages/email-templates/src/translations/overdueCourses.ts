import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

import type { OverdueCoursesEmailCourse } from "../templates/OverdueCoursesEmail";

type OverdueCoursesEmailLabels = {
  heading: string;
  intro: string;
  buttonText: string;
  courseLabel: string;
  groupLabel: string;
  dueDateLabel: string;
  studentsLabel: string;
};

const buildOverdueCoursesParagraphs = (
  courses: OverdueCoursesEmailCourse[],
  labels: OverdueCoursesEmailLabels,
) => {
  const indent = "    ";

  return [
    labels.intro,
    "",
    ...courses.flatMap((course) => [
      `${labels.courseLabel}: ${course.courseTitle}`,
      ...course.groups.flatMap((group) => [
        `${indent}${labels.groupLabel}: ${group.groupName}`,
        `${indent}${labels.dueDateLabel}: ${group.dueDate}`,
        `${indent}${labels.studentsLabel}:`,
        ...group.students.map((student) => `${indent}- ${student.name} (${student.email})`),
        "",
      ]),
    ]),
  ];
};

export const getOverdueCoursesEmailTranslations = (
  language: SupportedLanguages,
  courses: OverdueCoursesEmailCourse[],
) => {
  const labels: Record<SupportedLanguages, OverdueCoursesEmailLabels> = {
    en: {
      heading: "Students with overdue courses",
      intro: "Some students did not finish their courses on time:",
      buttonText: "VIEW COURSES",
      courseLabel: "Course",
      groupLabel: "Group",
      dueDateLabel: "Due date",
      studentsLabel: "Students",
    },
    pl: {
      heading: "Zaległe kursy studentów",
      intro: "Niektórzy studenci nie ukończyli kursów w wymaganym terminie:",
      buttonText: "PRZEJDŹ DO KURSÓW",
      courseLabel: "Kurs",
      groupLabel: "Grupa",
      dueDateLabel: "Termin",
      studentsLabel: "Studenci",
    },
    de: {
      heading: "Teilnehmende mit überfälligen Kursen",
      intro: "Einige Teilnehmende haben ihre Kurse nicht rechtzeitig abgeschlossen:",
      buttonText: "KURSE ANZEIGEN",
      courseLabel: "Kurs",
      groupLabel: "Gruppe",
      dueDateLabel: "Fälligkeitsdatum",
      studentsLabel: "Teilnehmende",
    },
    lt: {
      heading: "Studentai su vėluojančiais kursais",
      intro: "Kai kurie studentai nebaigė kursų laiku:",
      buttonText: "PERŽIŪRĖTI KURSUS",
      courseLabel: "Kursas",
      groupLabel: "Grupė",
      dueDateLabel: "Terminas",
      studentsLabel: "Studentai",
    },
    cs: {
      heading: "Studenti s kurzy po termínu",
      intro: "Někteří studenti nedokončili kurzy v požadovaném termínu:",
      buttonText: "ZOBRAZIT KURZY",
      courseLabel: "Kurz",
      groupLabel: "Skupina",
      dueDateLabel: "Termín",
      studentsLabel: "Studenti",
    },
    es: {
      heading: "Estudiantes con cursos vencidos",
      intro: "Algunos estudiantes no completaron sus cursos a tiempo:",
      buttonText: "VER CURSOS",
      courseLabel: "Curso",
      groupLabel: "Grupo",
      dueDateLabel: "Fecha límite",
      studentsLabel: "Estudiantes",
    },
  };

  const selectedLabels = labels[language];

  return {
    heading: selectedLabels.heading,
    paragraphs: buildOverdueCoursesParagraphs(courses, selectedLabels),
    buttonText: selectedLabels.buttonText,
  } satisfies EmailContent;
};
