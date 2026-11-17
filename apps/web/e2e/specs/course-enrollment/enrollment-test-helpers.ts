import { LEARNER_PASSWORD } from "../../data/test-data/accounts.data";

import type { FixtureFactories } from "../../factories";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

/**
 * Arranges a published course with one content lesson and a registered learner who can sign in,
 * so enrollment changes can be verified from the learner's side. Runs as the current admin.
 */
export const arrangeEnrollmentCourse = async ({
  cleanup,
  factories,
  prefix,
}: {
  cleanup: Cleanup;
  factories: FixtureFactories;
  prefix: string;
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const curriculumFactory = factories.createCurriculumFactory();
  const userFactory = factories.createUserFactory();

  const category = await categoryFactory.create(`${prefix}-category`);
  cleanup.add(() => categoryFactory.delete(category.id));

  const course = await courseFactory.create({
    title: `${prefix}-course`,
    categoryId: category.id,
    language: "en",
  });
  cleanup.add(() => courseFactory.delete(course.id));

  const chapter = await curriculumFactory.createChapter({
    courseId: course.id,
    title: `${prefix}-chapter`,
  });
  const lesson = await curriculumFactory.createContentLesson(course.id, {
    chapterId: chapter.id,
    title: `${prefix}-lesson`,
  });
  await courseFactory.update(course.id, { status: "published", language: "en" });

  const learner = await userFactory.register({
    email: `${prefix}-learner@example.com`,
    firstName: "Enrollment Learner",
    lastName: prefix,
    password: LEARNER_PASSWORD,
  });
  cleanup.add(() => userFactory.delete(learner.id));

  return { course, lesson, learner, learnerPassword: LEARNER_PASSWORD };
};
