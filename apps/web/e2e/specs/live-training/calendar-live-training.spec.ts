import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CALENDAR_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCalendarLiveTrainingFormFlow } from "../../flows/live-training/fill-calendar-live-training-form.flow";
import { openCalendarCreateLiveTrainingDialogFlow } from "../../flows/live-training/open-calendar-create-live-training-dialog.flow";
import { openCalendarFlow } from "../../flows/live-training/open-calendar.flow";

const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getCalendarRangeAround = (dateIso: string) => {
  const date = new Date(dateIso);
  const start = new Date(date);
  const end = new Date(date);

  start.setDate(start.getDate() - 1);
  end.setDate(end.getDate() + 1);

  return { start: start.toISOString(), end: end.toISOString() };
};

test("admin can open a Live Training calendar event and navigate to details page", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const liveTrainingFactory = factories.createLiveTrainingFactory();
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `calendar-open-${Date.now()}`,
      location: "Room 101",
    });

    cleanup.add(async () => {
      await liveTrainingFactory.delete(liveTraining.id);
    });

    const calendarRange = getCalendarRangeAround(liveTraining.startsAt);

    await expect
      .poll(async () => {
        const response = await apiClient.api.calendarControllerGetEvents({
          ...calendarRange,
          language: "en",
        });

        return response.data.data.events.some((event) => event.id === liveTraining.calendarEventId);
      })
      .toBe(true);

    await openCalendarFlow(page);
    await page
      .getByTestId(CALENDAR_HANDLES.event(liveTraining.calendarEventId))
      .dispatchEvent("click");

    await expect(page.getByTestId(CALENDAR_HANDLES.EVENT_DETAILS_DIALOG)).toBeVisible();
    await expect(page.getByTestId(CALENDAR_HANDLES.EVENT_DETAILS_DIALOG)).toContainText(
      liveTraining.title,
    );
    await expect(page.getByTestId(CALENDAR_HANDLES.EVENT_DETAILS_DIALOG)).toContainText("Room 101");

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
    const selectedDate = getTomorrowDate();

    await liveTrainingFactory.ensureLiveTrainingEnabled();

    await openCalendarFlow(page);
    await openCalendarCreateLiveTrainingDialogFlow(page, selectedDate);
    await fillCalendarLiveTrainingFormFlow(page, {
      title,
      description: `Description for ${title}`,
      deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
      location: "Workshop room",
      maxParticipants: 12,
    });
    await page.getByTestId(CALENDAR_HANDLES.CREATE_SUBMIT_BUTTON).click();

    await expect
      .poll(async () => {
        const liveTraining = await liveTrainingFactory.findByTitle(title);
        return liveTraining?.id ?? null;
      })
      .not.toBeNull();

    const liveTraining = await liveTrainingFactory.findByTitle(title);

    expect(liveTraining).not.toBeNull();

    cleanup.add(async () => {
      if (liveTraining) await liveTrainingFactory.delete(liveTraining.id);
    });

    const calendarRange = getCalendarRangeAround(liveTraining!.startsAt);

    await expect
      .poll(async () => {
        const response = await apiClient.api.calendarControllerGetEvents({
          ...calendarRange,
          language: "en",
        });

        return response.data.data.events.some(
          (event) => event.id === liveTraining!.calendarEventId,
        );
      })
      .toBe(true);

    await expect(page.getByTestId(CALENDAR_HANDLES.CREATE_DIALOG)).toBeHidden();
    await expect(
      page.getByTestId(CALENDAR_HANDLES.event(liveTraining!.calendarEventId)),
    ).toHaveCount(1);
  });
});
