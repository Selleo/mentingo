import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CALENDAR_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCalendarLiveTrainingFormFlow } from "../../flows/live-training/fill-calendar-live-training-form.flow";
import { openCalendarCreateLiveTrainingDialogFlow } from "../../flows/live-training/open-calendar-create-live-training-dialog.flow";
import { openCalendarFlow } from "../../flows/live-training/open-calendar.flow";
import { waitForCalendarEventFlow } from "../../flows/live-training/wait-for-calendar-event.flow";
import { getTomorrowDate } from "../../utils/calendar-dates";

test("admin can open a Live Training calendar event and navigate to details page", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const liveTraining = await liveTrainingFactory.createOffline(cleanup, {
      title: `calendar-open-${Date.now()}`,
      location: "Room 101",
    });

    await waitForCalendarEventFlow(apiClient, liveTraining);

    await openCalendarFlow(page);
    const event = page.getByTestId(CALENDAR_HANDLES.event(liveTraining.calendarEventId));
    // The time grid scrolls internally; the chip can start below the fold.
    await event.scrollIntoViewIfNeeded();
    await event.click();

    const detailsDialog = page.getByTestId(CALENDAR_HANDLES.EVENT_DETAILS_DIALOG);
    await expect(detailsDialog).toBeVisible();
    await expect(detailsDialog).toContainText(liveTraining.title);
    await expect(detailsDialog).toContainText("Room 101");

    await page.getByTestId(CALENDAR_HANDLES.EVENT_DETAILS_GO_TO_LIVE_TRAINING).click();
    await expect(page).toHaveURL(new RegExp(`/live-training/${liveTraining.id}`));
  });
});

test("admin can create an offline Live Training from calendar", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const title = `calendar-create-${Date.now()}`;

    cleanup.add(await liveTrainingFactory.ensureLiveTrainingEnabled());
    // Registered before the UI creates it; the training is looked up by its unique title.
    cleanup.add(async () => {
      const liveTraining = await liveTrainingFactory.findByTitle(title);
      if (liveTraining) await liveTrainingFactory.delete(liveTraining.id);
    });

    await openCalendarFlow(page);
    await openCalendarCreateLiveTrainingDialogFlow(page, getTomorrowDate());
    await fillCalendarLiveTrainingFormFlow(page, {
      title,
      description: `Description for ${title}`,
      deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
      location: "Workshop room",
      maxParticipants: 12,
    });
    await page.getByTestId(CALENDAR_HANDLES.CREATE_SUBMIT_BUTTON).click();

    await expect
      .poll(async () => (await liveTrainingFactory.findByTitle(title))?.id ?? null)
      .not.toBeNull();
    const liveTraining = await liveTrainingFactory.findByTitle(title);
    if (!liveTraining) throw new Error(`Live Training ${title} was not created`);

    await waitForCalendarEventFlow(apiClient, liveTraining);

    await expect(page.getByTestId(CALENDAR_HANDLES.CREATE_DIALOG)).toBeHidden();
    await expect(
      page.getByTestId(CALENDAR_HANDLES.event(liveTraining.calendarEventId)),
    ).toHaveCount(1);
  });
});
