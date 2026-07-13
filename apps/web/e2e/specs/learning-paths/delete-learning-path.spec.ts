import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("admin can delete a learning path", async ({
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
      const learningPath = await learningPathFactory.create({
        title: `learning-path-delete-${Date.now()}`,
      });

      let learningPathDeleted = false;
      cleanup.add(async () => {
        if (!learningPathDeleted) await learningPathFactory.delete(learningPath.id);
      });

      await openAdminLearningPathsPageFlow(page);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id));
      await expect(card).toBeVisible();

      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.DELETE_TRIGGER).click();
      await page.getByTestId(LEARNING_PATH_CARD_HANDLES.DELETE_CONFIRM_BUTTON).click();

      await expect(card).toHaveCount(0);

      await expect.poll(async () => learningPathFactory.safeGetById(learningPath.id)).toBeNull();
      learningPathDeleted = true;
    },
    { root: true },
  );
});
