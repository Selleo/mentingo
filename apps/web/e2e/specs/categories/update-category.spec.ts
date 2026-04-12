import { USER_ROLE } from "~/config/userRoles";

import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";
import { expect, test } from "../../fixtures/test.fixture";

test("admin writer can update category title", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const createdCategory = await categoryFactory.create();
    const updatedTitle = `Updated Category ${Date.now()}`;

    cleanup.add(async () => {
      await categoryFactory.delete(createdCategory.id);
    });

    await page.goto(`/admin/categories/${createdCategory.id}`);
    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.HEADING)).toBeVisible();
    await page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE).fill(updatedTitle);
    await page.getByTestId(CATEGORY_PAGE_HANDLES.SAVE).click();
    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE)).toHaveValue(updatedTitle);

    await expect
      .poll(async () => {
        const updatedCategory = await categoryFactory.getById(createdCategory.id);

        return updatedCategory.title;
      })
      .toBe(updatedTitle);
  });
});
