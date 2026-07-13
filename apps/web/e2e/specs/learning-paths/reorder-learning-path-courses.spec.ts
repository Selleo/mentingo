import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

import type { Locator, Page } from "@playwright/test";

const dragOver = async (page: Page, source: Locator, target: Locator) => {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Expected reorder drag handles to be visible");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
};

test("admin can reorder courses on a learning path via drag and drop", async ({
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

      const category = await categoryFactory.create(`lp-reorder-category-${Date.now()}`);
      const firstCourse = await courseFactory.create({
        title: `lp-reorder-course-a-${Date.now()}`,
        categoryId: category.id,
      });
      const secondCourse = await courseFactory.create({
        title: `lp-reorder-course-b-${Date.now()}`,
        categoryId: category.id,
      });
      const learningPath = await learningPathFactory.create({
        title: `learning-path-reorder-${Date.now()}`,
      });
      await learningPathFactory.addCourses(learningPath.id, [firstCourse.id, secondCourse.id]);

      cleanup.add(async () => {
        await learningPathFactory.delete(learningPath.id);
        await courseFactory.delete(firstCourse.id);
        await courseFactory.delete(secondCourse.id);
        await categoryFactory.delete(category.id);
      });

      await openAdminLearningPathsPageFlow(page);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id));
      await expect(card).toBeVisible();

      await dragOver(
        page,
        card.getByTestId(LEARNING_PATH_CARD_HANDLES.courseDragHandle(secondCourse.id)),
        card.getByTestId(LEARNING_PATH_CARD_HANDLES.courseDragHandle(firstCourse.id)),
      );

      await expect
        .poll(async () => {
          const updated = await learningPathFactory.getById(learningPath.id);
          return updated.courses.map((course) => course.courseId);
        })
        .toEqual([secondCourse.id, firstCourse.id]);
    },
    { root: true },
  );
});
