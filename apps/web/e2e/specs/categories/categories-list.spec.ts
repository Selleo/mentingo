import { USER_ROLE } from "~/config/userRoles";

import { CATEGORIES_PAGE_HANDLES, CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterCategoriesFlow } from "../../flows/categories/filter-categories.flow";
import { openCategoriesPageFlow } from "../../flows/categories/open-categories-page.flow";
import { openCategoryDetailsFromListFlow } from "../../flows/categories/open-category-details-from-list.flow";
import { selectCategoriesFlow } from "../../flows/categories/select-categories.flow";

test("admin can browse, filter, sort, select, and open category details", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const prefix = `categories-list-${Date.now()}`;
    const titles = ["Alpha", "Beta", "Gamma"] as const;
    const categories = await categoryFactory.createMany(3, (index) => ({
      title: `${prefix}-${titles[index]}`,
    }));

    await categoryFactory.update(categories[1].id, { archived: true });

    cleanup.add(async () => {
      await categoryFactory.deleteMany(categories.map((category) => category.id));
    });

    await openCategoriesPageFlow(page);
    await filterCategoriesFlow(page, { title: prefix });

    const visibleRows = page.getByTestId(CATEGORIES_PAGE_HANDLES.TABLE_BODY).getByRole("row");

    await expect(visibleRows).toHaveCount(2);

    await filterCategoriesFlow(page, { archivedStatus: "all" });
    await expect(visibleRows).toHaveCount(3);

    await page.getByTestId(CATEGORIES_PAGE_HANDLES.SORT_TITLE).click();
    await expect(visibleRows.first()).toHaveAttribute(
      "data-testid",
      CATEGORIES_PAGE_HANDLES.row(categories[0].id),
    );

    await filterCategoriesFlow(page, { archivedStatus: "archived" });
    await expect(visibleRows).toHaveCount(1);
    await expect(page.getByTestId(CATEGORIES_PAGE_HANDLES.row(categories[1].id))).toBeVisible();

    await selectCategoriesFlow(page, [categories[1].id]);
    await expect(
      page.getByTestId(CATEGORIES_PAGE_HANDLES.rowCheckbox(categories[1].id)),
    ).toHaveAttribute("data-state", "checked");

    await openCategoryDetailsFromListFlow(page, categories[1].id);

    await expect(page).toHaveURL(new RegExp(`/admin/categories/${categories[1].id}$`));
    await expect(page.getByTestId(CATEGORY_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});
