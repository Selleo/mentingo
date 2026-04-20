import { USER_ROLE } from "~/config/userRoles";

import { CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { updateCategoryTitleFlow } from "../../flows/categories/update-category.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";

test("admin writer can update category title", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const createdCategory = await categoryFactory.create();
    const updatedTitle = `Updated Category ${Date.now()}`;

    cleanup.add(async () => {
      await categoryFactory.delete(createdCategory.id);
    });

    await updateCategoryTitleFlow(page, {
      categoryId: createdCategory.id,
      title: updatedTitle,
    });

    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.HEADING)).toBeVisible();
    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE)).toHaveValue(updatedTitle);

    await expect
      .poll(async () => {
        const updatedCategory = await categoryFactory.getById(createdCategory.id);
        return updatedCategory.title;
      })
      .toBe(updatedTitle);
  });
});

test("admin can archive a category from the details page", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const createdCategory = await categoryFactory.create(`Archive Category ${Date.now()}`);

    cleanup.add(async () => {
      await categoryFactory.delete(createdCategory.id);
    });

    await updateCategoryTitleFlow(page, {
      categoryId: createdCategory.id,
      archived: true,
    });

    await assertToastVisible(page, "Category updated successfully");
    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.ARCHIVED)).toHaveAttribute(
      "data-state",
      "checked",
    );

    await expect
      .poll(async () => {
        const updatedCategory = await categoryFactory.getById(createdCategory.id);
        return updatedCategory.archived;
      })
      .toBe(true);
  });
});
