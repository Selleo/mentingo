import { expect, type Page } from "@playwright/test";

import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

/**
 * Expands the chapter and opens the lesson. Whenever course data refetches (e.g. after a language
 * switch) the single-open chapter list auto-expands the most recently updated chapter, which can
 * collapse ours. So the trigger is clicked only while collapsed (a blind click would toggle an
 * auto-expanded chapter shut) and the check retries until the lesson card is visible.
 */
export const openExistingLessonFlow = async (page: Page, chapterId: string, lessonId: string) => {
  await waitForDialogOverlaysHiddenFlow(page);
  const accordion = page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapterId));
  const lessonCard = page.getByTestId(CURRICULUM_HANDLES.lessonCard(lessonId));

  await expect(async () => {
    if ((await accordion.getAttribute("aria-expanded")) !== "true") await accordion.click();
    await expect(accordion).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    await expect(lessonCard).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await lessonCard.click();
};
