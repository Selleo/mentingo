import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("student can self-enroll into a published learning path but not a draft one", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const learningPathFactory = factories.createLearningPathFactory();
  const learningPathEnrollmentFactory = factories.createLearningPathEnrollmentFactory();

  let draftLearningPathId = "";
  let publishedLearningPathId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      await ensureLearningPathsEnabled(apiClient);

      const draftLearningPath = await learningPathFactory.create({
        title: `learning-path-self-enroll-draft-${Date.now()}`,
        status: "draft",
      });
      draftLearningPathId = draftLearningPath.id;

      const publishedLearningPath = await learningPathFactory.create({
        title: `learning-path-self-enroll-published-${Date.now()}`,
        status: "published",
      });
      publishedLearningPathId = publishedLearningPath.id;

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await learningPathFactory.delete(draftLearningPathId);
            await learningPathFactory.delete(publishedLearningPathId);
          },
          { root: true },
        );
      });
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await expect(learningPathEnrollmentFactory.selfEnroll(draftLearningPathId)).rejects.toThrow();

      await openLearningPathsPageFlow(page);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(publishedLearningPathId));
      await expect(card).toBeVisible();

      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.SELF_ENROLL_BUTTON).click();
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLLED_BADGE)).toBeVisible();

      await expect
        .poll(async () => (await learningPathFactory.getById(publishedLearningPathId)).isEnrolled)
        .toBe(true);
    },
    { root: true },
  );
});
