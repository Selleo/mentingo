import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { waitForDialogOverlaysHiddenFlow } from "../common/wait-for-dialog-overlays-hidden.flow";

import type { Page } from "@playwright/test";

export const openExistingLessonFlow = async (page: Page, chapterId: string, lessonId: string) => {
  await waitForDialogOverlaysHiddenFlow(page);
  const accordion = page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapterId));
  const lessonCard = page.getByTestId(CURRICULUM_HANDLES.lessonCard(lessonId));

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

  await lessonCard.waitFor({ state: "visible" });
  await lessonCard.scrollIntoViewIfNeeded();
  await lessonCard.click();
};
