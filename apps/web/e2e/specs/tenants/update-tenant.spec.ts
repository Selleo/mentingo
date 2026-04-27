import { USER_ROLE } from "~/config/userRoles";

import { TENANT_FORM_HANDLES, TENANT_PAGE_HANDLES } from "../../data/tenants/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillTenantFormFlow } from "../../flows/tenants/fill-tenant-form.flow";
import { openTenantPageFlow } from "../../flows/tenants/open-tenant-page.flow";
import { submitTenantFormFlow } from "../../flows/tenants/submit-tenant-form.flow";

test("managing admin can update tenant details", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const tenantFactory = factories.createTenantFactory();
      const tenant = await tenantFactory.create();
      const suffix = Date.now();
      const updatedName = `updated-tenant-${suffix}`;
      const updatedHost = `http://updated-tenant-${suffix}.local`;

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      await openTenantPageFlow(page, tenant.id);
      await expect(page.getByTestId(TENANT_FORM_HANDLES.NAME_INPUT)).toHaveValue(tenant.name);
      await expect(page.getByTestId(TENANT_FORM_HANDLES.HOST_INPUT)).toHaveValue(tenant.host);

      await fillTenantFormFlow(page, {
        name: updatedName,
        host: updatedHost,
        status: "inactive",
      });
      await submitTenantFormFlow(page);

      await expect(page).toHaveURL(/\/super-admin\/tenants$/);

      await expect
        .poll(async () => {
          const updatedTenant = await tenantFactory.getById(tenant.id);
          return {
            name: updatedTenant.name,
            host: updatedTenant.host,
            status: updatedTenant.status,
          };
        })
        .toEqual({
          name: updatedName,
          host: updatedHost,
          status: "inactive",
        });
    },
    { root: true },
  );
});

test("managing admin cannot submit invalid tenant updates", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const tenantFactory = factories.createTenantFactory();
      const tenant = await tenantFactory.create();

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      await openTenantPageFlow(page, tenant.id);
      await fillTenantFormFlow(page, {
        name: "",
        host: "not-a-url",
      });
      await submitTenantFormFlow(page);

      await expect(page).toHaveURL(new RegExp(`/super-admin/tenants/${tenant.id}$`));
      await expect(page.getByTestId(TENANT_PAGE_HANDLES.PAGE)).toBeVisible();

      const persistedTenant = await tenantFactory.getById(tenant.id);
      expect(persistedTenant.name).toBe(tenant.name);
      expect(persistedTenant.host).toBe(tenant.host);
    },
    { root: true },
  );
});
