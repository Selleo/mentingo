import { USER_ROLE } from "~/config/userRoles";

import { CREATE_CATEGORY_PAGE_HANDLES } from "../../data/categories/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateCategoryFormFlow } from "../../flows/categories/fill-create-category-form.flow";
import { openCreateCategoryPageFlow } from "../../flows/categories/open-create-category-page.flow";
import { submitCreateCategoryFormFlow } from "../../flows/categories/submit-create-category-form.flow";
import { assertToastVariantVisible } from "../../utils/assert-toast-visible";

test("admin cannot submit invalid category data", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openCreateCategoryPageFlow(page);

    await expect(page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();

    await fillCreateCategoryFormFlow(page, { title: "A" });

    await expect(page.getByTestId(CREATE_CATEGORY_PAGE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();
  });
});

test("admin sees a conflict when creating a duplicate category title", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const existingCategory = await categoryFactory.create(`Duplicate Category ${Date.now()}`);

    cleanup.add(async () => {
      await categoryFactory.delete(existingCategory.id);
    });

    await openCreateCategoryPageFlow(page);
    await fillCreateCategoryFormFlow(page, { title: existingCategory.title });
    await submitCreateCategoryFormFlow(page);

    await assertToastVariantVisible(page, "destructive");
    await expect(page).toHaveURL(/\/admin\/categories\/new$/);
  });
});
