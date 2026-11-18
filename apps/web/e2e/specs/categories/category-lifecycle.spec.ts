import { USER_ROLE } from "~/config/userRoles";

import { CATEGORIES_PAGE_HANDLES, CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmDeleteCategoriesFlow } from "../../flows/categories/confirm-delete-categories.flow";
import { fillCategoryFormFlow } from "../../flows/categories/fill-category-form.flow";
import { fillCreateCategoryFormFlow } from "../../flows/categories/fill-create-category-form.flow";
import { filterCategoriesFlow } from "../../flows/categories/filter-categories.flow";
import { openCategoriesPageFlow } from "../../flows/categories/open-categories-page.flow";
import { openCreateCategoryPageFlow } from "../../flows/categories/open-create-category-page.flow";
import { saveCategoryFormFlow } from "../../flows/categories/save-category-form.flow";
import { selectCategoriesFlow } from "../../flows/categories/select-categories.flow";
import { submitCreateCategoryFormFlow } from "../../flows/categories/submit-create-category-form.flow";

test("admin can create, rename and delete a category", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const title = `Create Category ${Date.now()}`;
    const updatedTitle = `Updated Category ${Date.now()}`;

    cleanup.add(async () => {
      for (const candidateTitle of [title, updatedTitle]) {
        const category = await categoryFactory.findByTitle(candidateTitle);

        if (category) await categoryFactory.delete(category.id);
      }
    });

    await openCreateCategoryPageFlow(page);
    await fillCreateCategoryFormFlow(page, { title });
    await submitCreateCategoryFormFlow(page);

    await expect.poll(async () => (await categoryFactory.findByTitle(title))?.id).toBeTruthy();
    const category = await categoryFactory.findByTitle(title);

    if (!category) throw new Error(`Expected category ${title} to exist`);

    await expect(page).toHaveURL(new RegExp(`/admin/categories/${category.id}$`));
    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE)).toHaveValue(title);

    await fillCategoryFormFlow(page, { title: updatedTitle });
    await saveCategoryFormFlow(page);

    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.TITLE)).toHaveValue(updatedTitle);
    await expect
      .poll(async () => (await categoryFactory.getById(category.id)).title)
      .toBe(updatedTitle);

    await openCategoriesPageFlow(page);
    await filterCategoriesFlow(page, { title: updatedTitle });
    await expect(page.getByTestId(CATEGORIES_PAGE_HANDLES.row(category.id))).toBeVisible();
    await selectCategoriesFlow(page, [category.id]);
    await confirmDeleteCategoriesFlow(page);

    await expect(page.getByTestId(CATEGORIES_PAGE_HANDLES.DELETE_DIALOG)).toHaveCount(0);
    await expect(page.getByTestId(CATEGORIES_PAGE_HANDLES.row(category.id))).toHaveCount(0);
    await expect.poll(() => categoryFactory.findByTitle(updatedTitle)).toBeNull();
  });
});
