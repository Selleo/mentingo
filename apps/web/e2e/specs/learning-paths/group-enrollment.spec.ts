import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_ENROLLED_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLearningPathEnrollmentDrawerFlow } from "../../flows/learning-paths/open-learning-path-enrollment-drawer.flow";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("admin can enroll and unenroll a group on a learning path", async ({
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
      const groupFactory = factories.createGroupFactory();
      const userFactory = factories.createUserFactory();

      const learningPath = await learningPathFactory.create({
        title: `learning-path-group-enroll-${Date.now()}`,
      });
      const group = await groupFactory.create({ name: `learning-path-group-${Date.now()}` });
      const user = await userFactory.create({
        email: `lp-group-enroll-${Date.now()}@example.com`,
      });
      await userFactory.update(user.id, { groups: [group.id] });

      cleanup.add(async () => {
        await learningPathFactory.delete(learningPath.id);
        await userFactory.delete(user.id);
        await groupFactory.delete(group.id);
      });

      await openAdminLearningPathsPageFlow(page);
      await openLearningPathEnrollmentDrawerFlow(page, learningPath.id);

      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTIONS_TRIGGER).click();
      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ENROLL_ACTION).click();

      const dialog = page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTION_DIALOG);
      await expect(dialog).toBeVisible();

      await dialog.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTION_SELECT).click();
      await dialog.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.groupActionOption(group.id)).click();
      await dialog.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTION_CONFIRM_BUTTON).click();

      await expect
        .poll(async () => {
          const enrolledUsers = await learningPathEnrollmentFactory.getUsers(learningPath.id, {
            keyword: user.email,
          });
          return enrolledUsers[0]?.isEnrolledByGroup ?? false;
        })
        .toBe(true);

      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTIONS_TRIGGER).click();
      await page.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_UNENROLL_ACTION).click();

      await expect(dialog).toBeVisible();
      await dialog.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTION_SELECT).click();
      await dialog.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.groupActionOption(group.id)).click();
      await dialog.getByTestId(LEARNING_PATH_ENROLLED_HANDLES.GROUP_ACTION_CONFIRM_BUTTON).click();

      await expect
        .poll(async () => {
          const enrolledUsers = await learningPathEnrollmentFactory.getUsers(learningPath.id, {
            keyword: user.email,
          });
          return enrolledUsers[0]?.enrolledAt ?? null;
        })
        .toBeNull();
    },
    { root: true },
  );
});
