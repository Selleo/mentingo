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
  await withReadonlyPage(
    USER_ROLE.admin,
    async ({ page }) => {
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
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.SORT_LAST_ACTIVITY)).toBeVisible();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.SORT_RECENT_ACTIVITY_COUNT)).toBeVisible();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.STATUS_FILTER)).toBeVisible();

      await filterTenantsFlow(page, prefix);

      for (const tenant of tenants.slice(0, 2)) {
        await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenant.id))).toBeVisible();
        await expect(page.getByTestId(TENANTS_PAGE_HANDLES.activityCount(tenant.id))).toBeVisible();
        await expect(page.getByTestId(TENANTS_PAGE_HANDLES.activeUsers(tenant.id))).toBeVisible();
      }
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenants[2].id))).toBeHidden();

      await page.getByTestId(TENANTS_PAGE_HANDLES.STATUS_FILTER).click();
      await page.getByTestId(TENANTS_PAGE_HANDLES.statusFilterOption("inactive")).click();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenants[2].id))).toBeVisible();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenants[0].id))).toBeHidden();

      await page.getByTestId(TENANTS_PAGE_HANDLES.STATUS_FILTER).click();
      await page.getByTestId(TENANTS_PAGE_HANDLES.statusFilterOption("all")).click();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenants[0].id))).toBeVisible();

      await page.getByTestId(TENANTS_PAGE_HANDLES.SORT_RECENT_ACTIVITY_COUNT).click();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.PAGE)).toBeVisible();

      await openTenantDetailsFromListFlow(page, tenants[0].id);

      await expect(page).toHaveURL(new RegExp(`/super-admin/tenants/${tenants[0].id}$`));
      await expect(page.getByTestId(TENANT_PAGE_HANDLES.PAGE)).toBeVisible();
    },
    { root: true },
  );
});

test("managing admin can open create tenant page from the tenant list", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await openTenantsPageFlow(page);
      await openCreateTenantFromListFlow(page);

      await expect(page).toHaveURL(/\/super-admin\/tenants\/new$/);
    },
    { root: true },
  );
});

test("managing admin can permanently delete another organization", async ({
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const tenantFactory = factories.createTenantFactory();
      const name = `tenant-delete-${Date.now()}`;
      const tenant = await tenantFactory.create({
        name,
        host: `http://${name}.local`,
      });

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, name);
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenant.id))).toBeVisible();

      await page.getByTestId(TENANTS_PAGE_HANDLES.actionsMenuButton(tenant.id)).click();
      await page.getByTestId(TENANTS_PAGE_HANDLES.deleteButton(tenant.id)).click();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG)).toBeVisible();
      await page.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON).click();

      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG)).toBeHidden();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenant.id))).toBeHidden();
      await expect.poll(() => tenantFactory.findByName(name)).toBeNull();
    },
    { root: true },
  );
});

test("non-managing user cannot access tenant administration", async ({ withReadonlyPage }) => {
  await withReadonlyPage(
    USER_ROLE.student,
    async ({ page }) => {
      await page.goto("/super-admin/tenants");

      await expect(page).not.toHaveURL(/\/super-admin\/tenants$/);
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.PAGE)).toBeHidden();
    },
    { root: true },
  );
});
