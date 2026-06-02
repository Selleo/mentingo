import { LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLiveTrainingFlow } from "../../flows/live-training/open-live-training.flow";

test("Live Training materials and session data are permission-gated", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const liveTrainingFactory = factories.createLiveTrainingFactory();
  let liveTrainingId = "";
  let beforeResourceId = "";
  let afterResourceId = "";

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `materials-${Date.now()}`,
      description: "Materials visibility",
    });

    liveTrainingId = liveTraining.id;
    cleanup.add(async () => {
      try {
        await liveTrainingFactory.delete(liveTrainingId);
      } catch {
        return;
      }
    });

    const beforeResource = await liveTrainingFactory.uploadResource(liveTrainingId, {
      filePath: CURRICULUM_TEST_DATA.files.documentPreview,
      contentType: "application/pdf",
      relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
    });
    const afterResource = await liveTrainingFactory.uploadResource(liveTrainingId, {
      filePath: CURRICULUM_TEST_DATA.files.presentationPreview,
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
    });

    beforeResourceId = beforeResource.resourceId;
    afterResourceId = afterResource.resourceId;

    await openLiveTrainingFlow(page, liveTrainingId);
    await page.getByTestId(LIVE_TRAINING_HANDLES.FILES_TAB).click();
    await expect(
      page.getByTestId(LIVE_TRAINING_HANDLES.beforeFileCard(beforeResourceId)),
    ).toBeVisible();
    await page.getByTestId(LIVE_TRAINING_HANDLES.AFTER_FILES_TAB).click();
    await expect(
      page.getByTestId(LIVE_TRAINING_HANDLES.afterFileCard(afterResourceId)),
    ).toBeVisible();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_TAB)).toBeVisible();
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openLiveTrainingFlow(page, liveTrainingId);
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_TAB)).toHaveCount(0);
    await page.getByTestId(LIVE_TRAINING_HANDLES.FILES_TAB).click();
    await expect(
      page.getByTestId(LIVE_TRAINING_HANDLES.beforeFileCard(beforeResourceId)),
    ).toBeVisible();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.AFTER_FILES_TAB)).toBeDisabled();
    await expect(
      page.getByTestId(LIVE_TRAINING_HANDLES.afterFileCard(afterResourceId)),
    ).toHaveCount(0);
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    const session = await liveTrainingFactory.startSession(liveTrainingId);
    await liveTrainingFactory.endSession(liveTrainingId, session.id);
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openLiveTrainingFlow(page, liveTrainingId);
    await page.getByTestId(LIVE_TRAINING_HANDLES.FILES_TAB).click();
    await page.getByTestId(LIVE_TRAINING_HANDLES.AFTER_FILES_TAB).click();
    await expect(
      page.getByTestId(LIVE_TRAINING_HANDLES.afterFileCard(afterResourceId)),
    ).toBeVisible();
  });
});
