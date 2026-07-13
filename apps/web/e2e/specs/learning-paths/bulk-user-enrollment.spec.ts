import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_ENROLLED_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLearningPathEnrollmentDrawerFlow } from "../../flows/learning-paths/open-learning-path-enrollment-drawer.flow";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("admin can bulk enroll and unenroll selected users on a learning path", async ({
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
      const learningPathEnrollmentFactory = factories.createLearningPathEnrollmentFactory();
      const userFactory = factories.createUserFactory();

      const tag = `lp-bulk-${Date.now()}`;
      const learningPath = await learningPathFactory.create({
        title: `learning-path-bulk-enroll-${Date.now()}`,
      });
      const users = await userFactory.createMany(2, (index) => ({
        email: `${tag}-${index}@example.com`,
        firstName: `E2E LP Bulk ${tag}`,
        lastName: `User ${index}`,
      }));

      cleanup.add(async () => {
        await learningPathFactory.delete(learningPath.id);
        for (const user of users) await userFactory.delete(user.id);
      });

      await openAdminLearningPathsPageFlow(page);
      await openLearningPathEnrollmentDrawerFlow(page, learningPath.id);

      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.SEARCH_INPUT).fill(tag);

      for (const user of users) {
        await expect(page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.row(user.id))).toBeVisible();
        await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.rowCheckbox(user.id)).click();
      }

      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.USER_ACTIONS_TRIGGER).click();
      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.USER_ENROLL_SELECTED_ACTION).click();
      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.ENROLL_USERS_CONFIRM_BUTTON).click();

      await expect
        .poll(async () => {
          const enrolledUsers = await learningPathEnrollmentFactory.getUsers(learningPath.id, {
            keyword: tag,
          });
          return enrolledUsers.every((user) => Boolean(user.enrolledAt));
        })
        .toBe(true);

      for (const user of users) {
        await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.rowCheckbox(user.id)).click();
      }

      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.USER_ACTIONS_TRIGGER).click();
      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.USER_UNENROLL_SELECTED_ACTION).click();
      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.UNENROLL_USERS_CONFIRM_BUTTON).click();

      await expect
        .poll(async () => {
          const enrolledUsers = await learningPathEnrollmentFactory.getUsers(learningPath.id, {
            keyword: tag,
          });
          return enrolledUsers.every((user) => !user.enrolledAt);
        })
        .toBe(true);
    },
    { root: true },
  );
});
