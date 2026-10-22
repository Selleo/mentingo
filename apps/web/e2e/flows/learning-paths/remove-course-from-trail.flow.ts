import { LEARNING_PATH_TRAIL_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const removeCourseFromTrailFlow = async (page: Page, courseId: string) => {
  await page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(courseId)).hover();
  await page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.removeButton(courseId)).click();
};
