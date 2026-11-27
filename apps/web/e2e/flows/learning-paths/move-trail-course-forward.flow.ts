import { expect, type Locator, type Page } from "@playwright/test";

import { LEARNING_PATH_TRAIL_HANDLES } from "../../data/learning-paths/handles";

const getLeftEdge = async (locator: Locator) => (await locator.boundingBox())?.x ?? 0;

/**
 * Moves a trail course one stop forward with the keyboard drag handle.
 * dnd-kit only measures drop targets after the drag has started, so an arrow key pressed too
 * early is ignored and the course is dropped where it was. Press it until the course moves.
 * While dragging, the drag overlay renders a second copy of the stop; `.first()` is the trail one.
 */
export const moveTrailCourseForwardFlow = async (page: Page, courseId: string) => {
  const courseStop = page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(courseId)).first();
  const dragHandle = page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.dragHandle(courseId)).first();

  await courseStop.hover();
  const startLeftEdge = await getLeftEdge(courseStop);

  await dragHandle.focus();
  await page.keyboard.press("Space");
  await expect(dragHandle).toHaveAttribute("aria-pressed", "true");

  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => getLeftEdge(courseStop), { timeout: 1_000 })
      .toBeGreaterThan(startLeftEdge);
  }).toPass();

  await page.keyboard.press("Space");
  await expect(dragHandle).not.toHaveAttribute("aria-pressed", "true");
};
