import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("content creator cannot manage a learning path authored by someone else", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const learningPathFactory = factories.createLearningPathFactory();
  let learningPathId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      await ensureLearningPathsEnabled(apiClient);

      const learningPath = await learningPathFactory.create({
        title: `learning-path-admin-authored-${Date.now()}`,
        status: "published",
      });
      learningPathId = learningPath.id;

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await learningPathFactory.delete(learningPathId);
          },
          { root: true },
        );
      });
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.contentCreator,
    async ({ page }) => {
      await openAdminLearningPathsPageFlow(page);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));
      await expect(card).toBeVisible();

      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_TRIGGER)).toHaveCount(0);
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.SETTINGS_TRIGGER)).toHaveCount(0);
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.DELETE_TRIGGER)).toHaveCount(0);
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLLMENT_TRIGGER)).toHaveCount(0);
    },
    { root: true },
  );
});

test("content creator can edit their own learning path but still lacks delete and enrollment controls", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const learningPathFactory = factories.createLearningPathFactory();

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      await ensureLearningPathsEnabled(apiClient);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.contentCreator,
    async ({ page }) => {
      const learningPath = await learningPathFactory.create({
        title: `learning-path-own-${Date.now()}`,
      });

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await learningPathFactory.delete(learningPath.id);
          },
          { root: true },
        );
      });

      await openAdminLearningPathsPageFlow(page);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id));
      await expect(card).toBeVisible();

      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.DELETE_TRIGGER)).toHaveCount(0);
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLLMENT_TRIGGER)).toHaveCount(0);

      const updatedTitle = `${learningPath.title} Updated`;
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_TRIGGER).click();
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_INPUT).fill(updatedTitle);
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE_EDIT_INPUT).press("Enter");

      await expect
        .poll(async () => (await learningPathFactory.getById(learningPath.id)).title)
        .toBe(updatedTitle);
    },
    { root: true },
  );
});
