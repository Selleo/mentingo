import { COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const saveCourseSettingsFlow = async (page: Page) => {
  await page.getByTestId(COURSE_SETTINGS_HANDLES.SAVE_BUTTON).click();
};
