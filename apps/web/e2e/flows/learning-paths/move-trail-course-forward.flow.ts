import { LEARNING_PATH_TRAIL_HANDLES } from "../../data/learning-paths/handles";

import type { Page } from "@playwright/test";

export const moveTrailCourseForwardFlow = async (page: Page, courseId: string) => {
  await page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(courseId)).hover();

  const dragHandle = page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.dragHandle(courseId));
  await dragHandle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
};
