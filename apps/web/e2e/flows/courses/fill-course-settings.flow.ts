import { COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";

import { fillRichTextEditorFlow } from "./editor.flow";

import type { Page } from "@playwright/test";

type FillCourseSettingsFlowInput = {
  title?: string;
  categoryTitle?: string;
  description?: string;
};

export const fillCourseSettingsFlow = async (
  page: Page,
  { title, categoryTitle, description }: FillCourseSettingsFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(COURSE_SETTINGS_HANDLES.TITLE_INPUT).fill(title);
  }

  if (categoryTitle !== undefined) {
    await page.getByTestId(COURSE_SETTINGS_HANDLES.CATEGORY_SELECT).click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.categoryOption(categoryTitle)).click();
  }

  if (description !== undefined) {
    await fillRichTextEditorFlow(page, COURSE_SETTINGS_HANDLES.DESCRIPTION_EDITOR, description);
  }
};
