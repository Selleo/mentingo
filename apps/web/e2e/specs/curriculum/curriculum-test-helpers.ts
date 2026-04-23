import type { FixtureFactories } from "../../factories";

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
