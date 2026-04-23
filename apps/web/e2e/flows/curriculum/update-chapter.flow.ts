import { CHAPTER_FORM_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const updateChapterFlow = async (page: Page, chapterId: string, title: string) => {
  await page.getByTestId(CURRICULUM_HANDLES.chapterCard(chapterId)).click();
  await page.getByTestId(CHAPTER_FORM_HANDLES.TITLE_INPUT).fill(title);
  await page.getByTestId(CHAPTER_FORM_HANDLES.SAVE_BUTTON).click();
  await page.getByTestId(CHAPTER_FORM_HANDLES.ROOT).waitFor({ state: "hidden" });
};
