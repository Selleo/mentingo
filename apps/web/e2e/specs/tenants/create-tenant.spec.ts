import { USER_ROLE } from "~/config/userRoles";

import { CREATE_TENANT_PAGE_HANDLES, TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillTenantFormFlow } from "../../flows/tenants/fill-tenant-form.flow";
import { filterTenantsFlow } from "../../flows/tenants/filter-tenants.flow";
import { openCreateTenantPageFlow } from "../../flows/tenants/open-create-tenant-page.flow";
import { submitTenantFormFlow } from "../../flows/tenants/submit-tenant-form.flow";

test("managing admin can create a tenant from the create page", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const tenantFactory = factories.createTenantFactory();
      const suffix = Date.now();
      const name = `create-tenant-${suffix}`;
      const host = `http://create-tenant-${suffix}.local`;

      await openCreateTenantPageFlow(page);
      await fillTenantFormFlow(page, {
        name,
        host,
        status: "active",
        adminFirstName: "Create",
        adminLastName: "Tenant",
        adminEmail: `create-tenant-admin-${suffix}@example.com`,
      });
      await submitTenantFormFlow(page);

      await expect
        .poll(async () => {
          const createdTenant = await tenantFactory.findByHost(host);
          return createdTenant?.id ?? null;
        })
        .not.toBeNull();

      const createdTenant = await tenantFactory.findByHost(host);

      cleanup.add(async () => {
        if (createdTenant) {
          await tenantFactory.deactivate(createdTenant.id);
        }
      });

      await expect(page).toHaveURL(/\/super-admin\/tenants$/);
      await filterTenantsFlow(page, host);
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.row(createdTenant!.id))).toBeVisible();
    },
    { root: true },
  );
});

test("managing admin cannot submit invalid tenant data", async ({
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const tenantFactory = factories.createTenantFactory();
      const name = `invalid-tenant-${Date.now()}`;

      await openCreateTenantPageFlow(page);
      await fillTenantFormFlow(page, {
        name,
        host: "not-a-url",
        adminFirstName: "Invalid",
        adminLastName: "Tenant",
        adminEmail: "not-an-email",
      });
      await submitTenantFormFlow(page);

      await expect(page).toHaveURL(/\/super-admin\/tenants\/new$/);
      await expect(page.getByTestId(CREATE_TENANT_PAGE_HANDLES.PAGE)).toBeVisible();
      await expect(await tenantFactory.findByName(name)).toBeNull();
    },
    { root: true },
  );
});
