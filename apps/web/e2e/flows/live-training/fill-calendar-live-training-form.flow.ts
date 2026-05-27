import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";

import { LIVE_TRAINING_FORM_HANDLES } from "../../data/live-training/handles";

import type { Page } from "@playwright/test";

type FillCalendarLiveTrainingFormInput = {
  title: string;
  description?: string;
  deliveryType?: typeof LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;
  location?: string;
  maxParticipants?: number;
};

const FORM_PREFIX = "calendar-live-training";

export const fillCalendarLiveTrainingFormFlow = async (
  page: Page,
  input: FillCalendarLiveTrainingFormInput,
) => {
  await page.getByTestId(LIVE_TRAINING_FORM_HANDLES.titleInput(FORM_PREFIX)).fill(input.title);

  if (input.description) {
    await page
      .getByTestId(LIVE_TRAINING_FORM_HANDLES.descriptionInput(FORM_PREFIX))
      .fill(input.description);
  }

  if (input.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE) {
    await page.getByTestId(LIVE_TRAINING_FORM_HANDLES.deliveryTypeSelect(FORM_PREFIX)).click();
    await page
      .getByTestId(
        LIVE_TRAINING_FORM_HANDLES.deliveryTypeOption(LIVE_TRAINING_DELIVERY_TYPES.OFFLINE),
      )
      .click();
  }

  if (input.location) {
    await page
      .getByTestId(LIVE_TRAINING_FORM_HANDLES.locationInput(FORM_PREFIX))
      .fill(input.location);
  }

  if (input.maxParticipants) {
    await page
      .getByTestId(LIVE_TRAINING_FORM_HANDLES.maxParticipantsInput(FORM_PREFIX))
      .fill(String(input.maxParticipants));
  }
};
