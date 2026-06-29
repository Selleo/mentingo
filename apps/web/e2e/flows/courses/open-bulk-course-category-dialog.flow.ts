import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

export const openBulkCourseCategoryDialogFlow = async (page: Page, categoryId: string) => {
  await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER).click();
  await page.getByTestId(COURSES_PAGE_HANDLES.BULK_EDIT_CATEGORY_ACTION).click();
  await page.getByTestId(COURSES_PAGE_HANDLES.CATEGORY_DIALOG).waitFor();
  await page.getByTestId(COURSES_PAGE_HANDLES.CATEGORY_SELECT).click();
  await page.getByTestId(COURSES_PAGE_HANDLES.categoryOption(categoryId)).click();
};
