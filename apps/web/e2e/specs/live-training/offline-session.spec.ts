import { LIVE_TRAINING_SESSION_STATUSES, LIVE_TRAINING_STATUSES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLiveTrainingFlow } from "../../flows/live-training/open-live-training.flow";

test("admin can start and end an offline Live Training session", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const liveTrainingFactory = factories.createLiveTrainingFactory();

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `offline-session-${Date.now()}`,
      location: "Offline room",
    });
    cleanup.add(() => liveTrainingFactory.delete(liveTraining.id));

    await openLiveTrainingFlow(page, liveTraining.id);
    await page.getByTestId(LIVE_TRAINING_HANDLES.START_SESSION_BUTTON).click();

    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.STATUS_BADGE)).toContainText(
      LIVE_TRAINING_STATUSES.ACTIVE,
      { ignoreCase: true },
    );
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.FINISH_SESSION_BUTTON)).toBeVisible();

    await expect
      .poll(async () => (await liveTrainingFactory.get(liveTraining.id)).currentSession?.id ?? null)
      .not.toBeNull();
    const sessionId = (await liveTrainingFactory.get(liveTraining.id)).currentSession?.id ?? "";

    await page.getByTestId(LIVE_TRAINING_HANDLES.FINISH_SESSION_BUTTON).click();

    await expect
      .poll(async () => (await liveTrainingFactory.get(liveTraining.id)).status)
      .toBe(LIVE_TRAINING_STATUSES.ENDED);
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.STATUS_BADGE)).toContainText(
      LIVE_TRAINING_STATUSES.ENDED,
      { ignoreCase: true },
    );

    await page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_TAB).click();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_PANEL)).toBeVisible();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.sessionCard(sessionId))).toContainText(
      LIVE_TRAINING_SESSION_STATUSES.ENDED,
      { ignoreCase: true },
    );
  });
});
