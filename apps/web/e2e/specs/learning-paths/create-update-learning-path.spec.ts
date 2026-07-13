import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { addCourseToLearningPathFlow } from "../../flows/learning-paths/add-course-to-learning-path.flow";
import { createLearningPathFlow } from "../../flows/learning-paths/create-learning-path.flow";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { publishLearningPathFlow } from "../../flows/learning-paths/publish-learning-path.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("admin can create, edit, manage courses on, and publish a learning path", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await ensureLearningPathsEnabled(apiClient);

      const learningPathFactory = factories.createLearningPathFactory();
      const categoryFactory = factories.createCategoryFactory();
      const courseFactory = factories.createCourseFactory();

      const category = await categoryFactory.create(`learning-path-course-category-${Date.now()}`);
      const course = await courseFactory.create({
        title: `learning-path-course-${Date.now()}`,
        categoryId: category.id,
      });

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      const title = `E2E Learning Path Create ${Date.now()}`;
      const description = "E2E learning path create description";

      await openAdminLearningPathsPageFlow(page);
      await createLearningPathFlow(page, { title, description });

      await expect
        .poll(async () => Boolean(await learningPathFactory.findByTitle(title)), {
          timeout: 15_000,
        })
        .toBe(true);

      const created = await learningPathFactory.findByTitle(title);
      if (!created) throw new Error(`Learning path "${title}" was not created`);

      cleanup.add(async () => {
        await learningPathFactory.delete(created.id);
      });

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(created.id));
      await expect(card).toBeVisible();

      const updatedTitle = `${title} Updated`;
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_TRIGGER).click();
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_INPUT).fill(updatedTitle);
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_INPUT).press("Enter");

      await expect
        .poll(async () => (await learningPathFactory.getById(created.id)).title)
        .toBe(updatedTitle);

      await addCourseToLearningPathFlow(page, created.id, course.id);

      await expect
        .poll(async () => {
          const learningPath = await learningPathFactory.getById(created.id);
          return learningPath.courses.map((pathCourse) => pathCourse.courseId);
        })
        .toContain(course.id);

      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.removeCourseButton(course.id)).click();

      await expect
        .poll(async () => {
          const learningPath = await learningPathFactory.getById(created.id);
          return learningPath.courses.map((pathCourse) => pathCourse.courseId);
        })
        .not.toContain(course.id);

      await publishLearningPathFlow(page, created.id);

      await expect
        .poll(async () => (await learningPathFactory.getById(created.id)).status)
        .toBe("published");
    },
    { root: true },
  );
});
