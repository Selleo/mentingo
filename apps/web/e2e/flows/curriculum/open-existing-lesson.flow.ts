import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const openExistingLessonFlow = async (page: Page, chapterId: string, lessonId: string) => {
  await waitForDialogOverlaysHiddenFlow(page);
  const accordion = page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapterId));
  const lessonCardTestId = CURRICULUM_HANDLES.lessonCard(lessonId);
  const lessonCard = page.getByTestId(lessonCardTestId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await lessonCard.count()) > 0 && (await lessonCard.isVisible())) {
      break;
    }

    if (attempt === 2) {
      await page.reload();
      await page.getByTestId(CURRICULUM_HANDLES.ROOT).waitFor();
    }

    await accordion.waitFor({ state: "visible" });
    await accordion.scrollIntoViewIfNeeded();
    await accordion.click();
    await lessonCard.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentLessonCard = page.getByTestId(lessonCardTestId);

    await currentLessonCard.waitFor({ state: "visible" });
    try {
      await currentLessonCard.click();
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(250);
    }
  }
};
