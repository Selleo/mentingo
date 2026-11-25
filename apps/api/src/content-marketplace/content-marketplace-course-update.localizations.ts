import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { match } from "ts-pattern";

import { CONTENT_MARKETPLACE_UPDATE_NOTICE } from "./content-marketplace.constants";

import type {
  ContentMarketplaceCourseUpdateTexts,
  ContentMarketplaceUpdatedCourseTitles,
} from "./content-marketplace.types";

type CourseUpdateNotice = Pick<ContentMarketplaceCourseUpdateTexts, "title" | "message">;

type CourseUpdateCopy = {
  singleCourse: (courseTitle: string) => CourseUpdateNotice;
  severalCourses: (coursesWithNewVersion: string) => CourseUpdateNotice;
  remainingCourses: (remainingCount: number) => string;
};

const COURSE_UPDATE_COPY: Record<SupportedLanguages, CourseUpdateCopy> = {
  en: {
    singleCourse: (courseTitle) => ({
      title: "A marketplace course has a new version",
      message: `The content marketplace published a new version of ${courseTitle}. Open the content marketplace and sync the course to update it.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Marketplace courses have new versions",
      message: `The content marketplace published new versions of ${updatedCourses}. Open the content marketplace and sync these courses to update them.`,
    }),
    remainingCourses: (remainingCount) => `${remainingCount} more`,
  },
  pl: {
    singleCourse: (courseTitle) => ({
      title: "Kurs z marketplace ma nową wersję",
      message: `W marketplace opublikowano nową wersję kursu ${courseTitle}. Otwórz marketplace i zsynchronizuj kurs, aby go zaktualizować.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Kursy z marketplace mają nowe wersje",
      message: `W marketplace opublikowano nowe wersje kursów: ${updatedCourses}. Otwórz marketplace i zsynchronizuj te kursy, aby je zaktualizować.`,
    }),
    remainingCourses: (remainingCount) => `jeszcze ${remainingCount}`,
  },
  de: {
    singleCourse: (courseTitle) => ({
      title: "Ein Marketplace-Kurs hat eine neue Version",
      message: `Im Marketplace wurde eine neue Version von ${courseTitle} veröffentlicht. Öffnen Sie den Marketplace und synchronisieren Sie den Kurs, um ihn zu aktualisieren.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Marketplace-Kurse haben neue Versionen",
      message: `Im Marketplace wurden neue Versionen von ${updatedCourses} veröffentlicht. Öffnen Sie den Marketplace und synchronisieren Sie diese Kurse, um sie zu aktualisieren.`,
    }),
    remainingCourses: (remainingCount) => `${remainingCount} weitere`,
  },
  lt: {
    singleCourse: (courseTitle) => ({
      title: "Marketplace kursas turi naują versiją",
      message: `Marketplace paskelbta nauja kurso ${courseTitle} versija. Atidarykite marketplace ir sinchronizuokite kursą, kad jį atnaujintumėte.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Marketplace kursai turi naujas versijas",
      message: `Marketplace paskelbtos naujos kursų versijos: ${updatedCourses}. Atidarykite marketplace ir sinchronizuokite šiuos kursus, kad juos atnaujintumėte.`,
    }),
    remainingCourses: (remainingCount) => `dar ${remainingCount}`,
  },
  cs: {
    singleCourse: (courseTitle) => ({
      title: "Kurz z marketplace má novou verzi",
      message: `V marketplace byla zveřejněna nová verze kurzu ${courseTitle}. Otevřete marketplace a synchronizujte kurz, abyste ho aktualizovali.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Kurzy z marketplace mají nové verze",
      message: `V marketplace byly zveřejněny nové verze kurzů: ${updatedCourses}. Otevřete marketplace a synchronizujte tyto kurzy, abyste je aktualizovali.`,
    }),
    remainingCourses: (remainingCount) => `ještě ${remainingCount}`,
  },
  es: {
    singleCourse: (courseTitle) => ({
      title: "Un curso del marketplace tiene una nueva versión",
      message: `El marketplace ha publicado una nueva versión de ${courseTitle}. Abre el marketplace y sincroniza el curso para actualizarlo.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Cursos del marketplace tienen nuevas versiones",
      message: `El marketplace ha publicado nuevas versiones de ${updatedCourses}. Abre el marketplace y sincroniza estos cursos para actualizarlos.`,
    }),
    remainingCourses: (remainingCount) => `${remainingCount} más`,
  },
  fr: {
    singleCourse: (courseTitle) => ({
      title: "Un cours du marketplace a une nouvelle version",
      message: `Le marketplace a publié une nouvelle version de ${courseTitle}. Ouvrez le marketplace et synchronisez le cours pour le mettre à jour.`,
    }),
    severalCourses: (updatedCourses) => ({
      title: "Des cours du marketplace ont de nouvelles versions",
      message: `Le marketplace a publié de nouvelles versions de ${updatedCourses}. Ouvrez le marketplace et synchronisez ces cours pour les mettre à jour.`,
    }),
    remainingCourses: (remainingCount) => `${remainingCount} autres`,
  },
};

/** Names every course unless at least two would be left over, which are then counted instead. */
const summarizeCourseTitles = (courseTitles: string[], language: SupportedLanguages) => {
  const listFormat = new Intl.ListFormat(language, { type: "conjunction" });
  const remainingCount = courseTitles.length - CONTENT_MARKETPLACE_UPDATE_NOTICE.NAMED_COURSES;

  if (remainingCount < CONTENT_MARKETPLACE_UPDATE_NOTICE.MIN_SUMMARIZED_COURSES)
    return listFormat.format(courseTitles);

  return listFormat.format([
    ...courseTitles.slice(0, CONTENT_MARKETPLACE_UPDATE_NOTICE.NAMED_COURSES),
    COURSE_UPDATE_COPY[language].remainingCourses(remainingCount),
  ]);
};

const buildCourseUpdateTexts = (
  updatedCourses: ContentMarketplaceUpdatedCourseTitles[],
  language: SupportedLanguages,
): ContentMarketplaceCourseUpdateTexts => {
  const alphabeticalTitles = updatedCourses
    .map((updatedCourse) => updatedCourse[language])
    .sort((firstTitle, secondTitle) => firstTitle.localeCompare(secondTitle, language));
  const coursesWithNewVersion = summarizeCourseTitles(alphabeticalTitles, language);
  const copy = COURSE_UPDATE_COPY[language];

  const notice = match(updatedCourses.length)
    .with(1, () => copy.singleCourse(coursesWithNewVersion))
    .otherwise(() => copy.severalCourses(coursesWithNewVersion));

  return {
    ...notice,
    coursesWithNewVersion,
    allCoursesWithNewVersion: new Intl.ListFormat(language, { type: "conjunction" }).format(
      alphabeticalTitles,
    ),
  };
};

export const getContentMarketplaceCourseUpdateTexts = (
  updatedCourses: ContentMarketplaceUpdatedCourseTitles[],
): Record<SupportedLanguages, ContentMarketplaceCourseUpdateTexts> =>
  Object.fromEntries(
    Object.values(SUPPORTED_LANGUAGES).map((language) => [
      language,
      buildCourseUpdateTexts(updatedCourses, language),
    ]),
  ) as Record<SupportedLanguages, ContentMarketplaceCourseUpdateTexts>;
