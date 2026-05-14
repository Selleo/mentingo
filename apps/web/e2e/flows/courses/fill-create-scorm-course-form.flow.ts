import { CREATE_SCORM_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import { fillRichTextEditorFlow } from "./editor.flow";

import type { Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

type FillCreateScormCourseFormFlowInput = {
  title?: string;
  categoryTitle?: string;
  language?: SupportedLanguages;
  description?: string;
  packagePath?: string;
};

export const fillCreateScormCourseFormFlow = async (
  page: Page,
  { title, categoryTitle, language, description, packagePath }: FillCreateScormCourseFormFlowInput,
) => {
  if (packagePath !== undefined) {
    await page
      .getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.PACKAGE_INPUT)
      .setInputFiles(packagePath);
  }

  if (title !== undefined) {
    await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.TITLE_INPUT).fill(title);
  }

  if (categoryTitle !== undefined) {
    await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.CATEGORY_SELECT).click();
    await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.categoryOption(categoryTitle)).click();
  }

  if (language !== undefined) {
    await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.LANGUAGE_SELECT).click();
    await page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.languageOption(language)).click();
  }

  if (description !== undefined) {
    await fillRichTextEditorFlow(
      page,
      CREATE_SCORM_COURSE_PAGE_HANDLES.DESCRIPTION_EDITOR,
      description,
    );
  }
};
