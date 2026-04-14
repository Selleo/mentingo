import { USER_ROLE } from "~/config/userRoles";

import { CATEGORIES_PAGE_HANDLES } from "../../data/categories/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmDeleteCategoriesFlow } from "../../flows/categories/confirm-delete-categories.flow";
import { filterCategoriesFlow } from "../../flows/categories/filter-categories.flow";
import { openCategoriesPageFlow } from "../../flows/categories/open-categories-page.flow";
import { selectCategoriesFlow } from "../../flows/categories/select-categories.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";

test("admin can bulk delete categories from the categories list", async ({
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const prefix = `bulk-delete-category-${Date.now()}`;
    const categories = await categoryFactory.createMany(2, (index) => ({
      title: `${prefix}-${index}`,
    }));

    await openCategoriesPageFlow(page);
    await filterCategoriesFlow(page, { title: prefix });
    await selectCategoriesFlow(
      page,
      categories.map((category) => category.id),
    );
    await confirmDeleteCategoriesFlow(page);

    await expect
      .poll(async () => {
        const existingCategories = await Promise.all(
          categories.map((category) => categoryFactory.findByTitle(category.title)),
        );

        return existingCategories.every((category) => category === null);
      })
      .toBe(true);
    await expect(page.getByTestId(CATEGORIES_PAGE_HANDLES.TABLE_BODY).getByRole("row")).toHaveCount(
      0,
    );
    await assertToastVisible(page, "Category deleted successfully", { optional: true });
  });
});
