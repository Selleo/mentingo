import { expect, type Page } from "@playwright/test";

import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

/**
 * Expands the chapter and opens the lesson. The chapter list expands a chapter by itself when course
 * data refreshes (e.g. after a language switch), so the trigger is clicked only while it is collapsed;
 * a blind click would collapse a chapter the app has just expanded.
 */
export const openExistingLessonFlow = async (page: Page, chapterId: string, lessonId: string) => {
  await waitForDialogOverlaysHiddenFlow(page);
  const accordion = page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapterId));
  const lessonCard = page.getByTestId(CURRICULUM_HANDLES.lessonCard(lessonId));

  await expect(async () => {
    if ((await accordion.getAttribute("aria-expanded")) !== "true") await accordion.click();
    await expect(accordion).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    await expect(lessonCard).toBeVisible({ timeout: 1_000 });
  }).toPass();

  await lessonCard.click();
};
