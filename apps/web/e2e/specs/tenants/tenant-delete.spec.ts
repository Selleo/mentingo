import { USER_ROLE } from "~/config/userRoles";

import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { deleteTenantFromListFlow } from "../../flows/tenants/delete-tenant-from-list.flow";
import { filterTenantsFlow } from "../../flows/tenants/filter-tenants.flow";
import { openTenantsPageFlow } from "../../flows/tenants/open-tenants-page.flow";

test("managing admin can permanently delete another organization", async ({
  cleanup,
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

      cleanup.add(async () => {
        if (await tenantFactory.findByName(name)) await tenantFactory.deactivate(tenant.id);
      });

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, name);
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenant.id))).toBeVisible();

      await deleteTenantFromListFlow(page, tenant.id);

      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG)).toBeHidden();
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(tenant.id))).toBeHidden();
      await expect.poll(() => tenantFactory.findByName(name)).toBeNull();
    },
    { root: true },
  );
});
