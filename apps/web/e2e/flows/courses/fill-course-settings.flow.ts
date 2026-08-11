import { expect, type Page } from "@playwright/test";

import { COURSE_SETTINGS_HANDLES } from "../../data/courses/handles";

type FillCourseSettingsFlowInput = {
  title?: string;
  currentCategoryTitle?: string;
  categoryTitle?: string;
  description?: string;
};

export const fillCourseSettingsFlow = async (
  page: Page,
  { title, currentCategoryTitle, categoryTitle, description }: FillCourseSettingsFlowInput,
) => {
  if (title !== undefined) {
    await page.getByTestId(COURSE_SETTINGS_HANDLES.TITLE_INPUT).click();
    const titleEditor = page.locator(
      `textarea[data-testid="${COURSE_SETTINGS_HANDLES.TITLE_INPUT}"]`,
    );
    await titleEditor.fill(title);
    await titleEditor.press("Enter");
    await expect(
      page.locator(`button[data-testid="${COURSE_SETTINGS_HANDLES.TITLE_INPUT}"]`),
    ).toHaveText(title);
  }

  if (categoryTitle !== undefined) {
    if (currentCategoryTitle !== undefined) {
      await page.getByRole("button", { name: currentCategoryTitle }).click();
    } else {
      await page.getByTestId(COURSE_SETTINGS_HANDLES.CATEGORY_SELECT).click();
    }

    await page.getByTestId(COURSE_SETTINGS_HANDLES.categoryOption(categoryTitle)).click();
  }

  if (description !== undefined) {
    const descriptionEditor = page
      .getByTestId(COURSE_SETTINGS_HANDLES.DESCRIPTION_EDITOR)
      .locator('[contenteditable="true"]');

    await descriptionEditor.fill(description);
    await descriptionEditor.blur();
  }
};
