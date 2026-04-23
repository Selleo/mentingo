import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const expandChapterFlow = async (page: Page, chapterId: string) => {
  const accordion = page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapterId));
  const addLessonButton = page.getByTestId(CURRICULUM_HANDLES.addLessonButton(chapterId));

  await accordion.waitFor({ state: "visible" });

  if ((await addLessonButton.count()) > 0 && (await addLessonButton.isVisible())) {
    return;
  }

  await accordion.click();
  await addLessonButton.waitFor({ state: "visible" });
};
