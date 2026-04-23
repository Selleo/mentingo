import { CREATE_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import { fillRichTextEditorFlow } from "./editor.flow";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

type FillCreateCourseFormFlowInput = {
  title?: string;
  categoryTitle?: string;
  language?: SupportedLanguages;
  description?: string;
};

export const fillCreateCourseFormFlow = async (
  page: Page,
  { title, categoryTitle, language, description }: FillCreateCourseFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }

  if (categoryTitle !== undefined) {
    await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.CATEGORY_SELECT).click();
    await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.categoryOption(categoryTitle)).click();
  }

  if (language !== undefined) {
    await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();
    await page.getByTestId(CREATE_COURSE_PAGE_HANDLES.languageOption(language)).click();
  }

  if (description !== undefined) {
    await fillRichTextEditorFlow(page, CREATE_COURSE_PAGE_HANDLES.DESCRIPTION_EDITOR, description);
  }
};
