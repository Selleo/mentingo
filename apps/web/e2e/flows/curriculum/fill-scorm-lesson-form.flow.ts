import { SCORM_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";

import type { Page } from "@playwright/test";

type FillScormLessonFormFlowInput = {
  title?: string;
  packagePath?: string;
};

export const fillScormLessonFormFlow = async (
  page: Page,
  { title, packagePath }: FillScormLessonFormFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(SCORM_LESSON_FORM_HANDLES.TITLE_INPUT).fill(title);
  }

  if (packagePath !== undefined) {
    await page.getByTestId(SCORM_LESSON_FORM_HANDLES.PACKAGE_INPUT).setInputFiles(packagePath);
  }
};
