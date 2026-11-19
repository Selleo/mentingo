import type { FixtureFactories } from "../../factories";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

type ArrangeCurriculumCourseInput = {
  cleanup: Cleanup;
  factories: FixtureFactories;
  title: string;
};

// Kept for specs outside curriculum; prefer arrangeCurriculumCourse/arrangeCurriculumChapter, which own cleanup.
export const createCurriculumCourse = async (factories: FixtureFactories, title: string) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const category = await categoryFactory.create(`Curriculum Category ${Date.now()}`);
  const course = await courseFactory.create({
    title,
    categoryId: category.id,
    language: "en",
  });

  return { category, course, categoryFactory, courseFactory };
};

/** Creates a draft English course in its own category and registers cleanup for both. */
export const arrangeCurriculumCourse = async ({
  cleanup,
  factories,
  title,
}: ArrangeCurriculumCourseInput) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const category = await categoryFactory.create(`Curriculum Category ${title}`);

  cleanup.add(async () => {
    await categoryFactory.delete(category.id);
  });

  const course = await courseFactory.create({
    title,
    categoryId: category.id,
    language: "en",
  });

  cleanup.add(async () => {
    await courseFactory.delete(course.id);
  });

  return { category, course, courseFactory };
};

/** Same as `arrangeCurriculumCourse`, plus one chapter named `<title>-chapter`. */
export const arrangeCurriculumChapter = async (input: ArrangeCurriculumCourseInput) => {
  const arranged = await arrangeCurriculumCourse(input);
  const chapter = await input.factories.createCurriculumFactory().createChapter({
    courseId: arranged.course.id,
    title: `${input.title}-chapter`,
  });

  return { ...arranged, chapter };
};

/**
 * Fills every German translation of an AI mentor course except the AI Judge configuration,
 * so the course still reports missing translations until the judge is translated.
 * The German course language must already exist.
 */
export const translateAiMentorCourseExceptJudge = async ({
  factories,
  courseId,
  courseTitle,
  chapterId,
  lessonId,
}: {
  factories: FixtureFactories;
  courseId: string;
  courseTitle: string;
  chapterId: string;
  lessonId: string;
}) => {
  const curriculumFactory = factories.createCurriculumFactory();

  await factories.createCourseFactory().update(courseId, {
    language: "de",
    title: `Deutscher ${courseTitle}`,
    description: "<p>Deutsche Kursbeschreibung</p>",
  });
  await curriculumFactory.updateChapterTranslation(chapterId, "de", "Deutsches Kapitel");
  await curriculumFactory.updateAiMentorLesson(lessonId, {
    language: "de",
    title: "Deutsche KI-Mentor-Lektion",
    description: "<p>Deutsche Lektionsbeschreibung</p>",
    name: "Ada",
    voiceMode: "preset",
    ttsPreset: "female",
    customTtsReference: null,
  });
  await curriculumFactory.updateAiMentorConfigurationTranslations(lessonId, "de", {
    type: "roleplay",
    scenario: "Führe ein realistisches Kundengespräch.",
    aiRole: "Kunde",
    learnerRole: "Vertriebsmitarbeiter",
    characterGoal: "Erreiche ein realistisches Ergebnis.",
  });
};
