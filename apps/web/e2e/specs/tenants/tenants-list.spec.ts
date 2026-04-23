import { USER_ROLE } from "~/config/userRoles";

import { TENANTS_PAGE_HANDLES, TENANT_PAGE_HANDLES } from "../../data/tenants/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterTenantsFlow } from "../../flows/tenants/filter-tenants.flow";
import { openCreateTenantFromListFlow } from "../../flows/tenants/open-create-tenant-from-list.flow";
import { openTenantDetailsFromListFlow } from "../../flows/tenants/open-tenant-details-from-list.flow";
import { openTenantsPageFlow } from "../../flows/tenants/open-tenants-page.flow";

test("managing admin can browse, filter, and open tenant details", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const tenantFactory = factories.createTenantFactory();
    const prefix = `tenants-list-${Date.now()}`;
    const tenants = await tenantFactory.createMany(3, (index) => ({
      name: `${prefix}-${index}`,
      host: `http://${prefix}-${index}.local`,
      status: index === 2 ? "inactive" : "active",
    }));

    cleanup.add(async () => {
      await Promise.all(tenants.map((tenant) => tenantFactory.deactivate(tenant.id)));
    });

    await openTenantsPageFlow(page);
    await expect(page.getByTestId(TENANTS_PAGE_HANDLES.CREATE_BUTTON)).toBeVisible();

    await filterTenantsFlow(page, prefix);

    for (const tenant of tenants) {
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenant.id))).toBeVisible();
    }

    await openTenantDetailsFromListFlow(page, tenants[0].id);

    await expect(page).toHaveURL(new RegExp(`/super-admin/tenants/${tenants[0].id}$`));
    await expect(page.getByTestId(TENANT_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});

test("managing admin can open create tenant page from the tenant list", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openTenantsPageFlow(page);
    await openCreateTenantFromListFlow(page);

    await expect(page).toHaveURL(/\/super-admin\/tenants\/new$/);
  });
});

test("non-managing user cannot access tenant administration", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await page.goto("/super-admin/tenants");

    await expect(page).not.toHaveURL(/\/super-admin\/tenants$/);
    await expect(page.getByTestId(TENANTS_PAGE_HANDLES.PAGE)).toBeHidden();
  });
});
