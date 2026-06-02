import { LIVE_TRAINING_SESSION_STATUSES, LIVE_TRAINING_STATUSES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LIVE_TRAINING_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";

test("admin can start and end an offline Live Training session", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `offline-session-${Date.now()}`,
      location: "Offline room",
    });

    cleanup.add(async () => {
      const currentLiveTraining = await liveTrainingFactory.get(liveTraining.id);

      if (currentLiveTraining.status !== LIVE_TRAINING_STATUSES.CANCELLED) {
        try {
          await liveTrainingFactory.delete(liveTraining.id);
        } catch {
          return;
        }
      }
    });

    await page.goto(`/live-training/${liveTraining.id}`);
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.PAGE)).toBeVisible();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.START_SESSION_BUTTON)).toBeVisible();

    await page.getByTestId(LIVE_TRAINING_HANDLES.START_SESSION_BUTTON).click();

    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.STATUS_BADGE)).toContainText(
      LIVE_TRAINING_STATUSES.ACTIVE,
      { ignoreCase: true },
    );
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.FINISH_SESSION_BUTTON)).toBeVisible();

    const activeTraining = await expect
      .poll(async () => {
        const nextLiveTraining = await liveTrainingFactory.get(liveTraining.id);
        return nextLiveTraining.currentSession?.id ?? null;
      })
      .not.toBeNull();

    void activeTraining;

    const sessionId = (await liveTrainingFactory.get(liveTraining.id)).currentSession?.id;

    await page.getByTestId(LIVE_TRAINING_HANDLES.FINISH_SESSION_BUTTON).click();

    await expect
      .poll(async () => {
        const nextLiveTraining = await liveTrainingFactory.get(liveTraining.id);
        return nextLiveTraining.status;
      })
      .toBe(LIVE_TRAINING_STATUSES.ENDED);

    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.STATUS_BADGE)).toContainText(
      LIVE_TRAINING_STATUSES.ENDED,
      { ignoreCase: true },
    );

    await page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_TAB).click();
    await expect(page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_PANEL)).toBeVisible();

    if (sessionId) {
      await expect(page.getByTestId(LIVE_TRAINING_HANDLES.sessionCard(sessionId))).toContainText(
        LIVE_TRAINING_SESSION_STATUSES.ENDED,
        { ignoreCase: true },
      );
    }
  });
});
