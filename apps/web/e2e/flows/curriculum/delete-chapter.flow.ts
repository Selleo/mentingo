import { CHAPTER_FORM_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

export const deleteChapterFlow = async (page: Page, chapterId: string) => {
  await page.getByTestId(CURRICULUM_HANDLES.chapterCard(chapterId)).click();
  await page.getByTestId(CHAPTER_FORM_HANDLES.DELETE_BUTTON).click();
  await page.getByRole("button", { name: "Delete" }).click();
};
