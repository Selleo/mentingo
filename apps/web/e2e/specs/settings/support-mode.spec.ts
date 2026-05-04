import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { SUPPORT_MODE_HANDLES } from "../../data/support-mode/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { enterSupportModeFromListFlow } from "../../flows/tenants/enter-support-mode-from-list.flow";
import { filterTenantsFlow } from "../../flows/tenants/filter-tenants.flow";
import { openTenantsPageFlow } from "../../flows/tenants/open-tenants-page.flow";
import { buildLmsLocalhostTenantHost } from "../../utils/tenant-host";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const requireOrigin = (origin?: string) => {
  if (!origin) {
    throw new Error("Expected authenticated page fixture to provide an origin");
  }

  return origin;
};

test("support-mode user does not see account settings and lands on organization tab", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ origin, page }) => {
      const tenantFactory = factories.createTenantFactory();
      const tenantSlug = Date.now();
      const tenantName = `settings-support-mode-${tenantSlug}`;
      const tenant = await tenantFactory.create({
        name: tenantName,
        host: buildLmsLocalhostTenantHost(requireOrigin(origin), tenantName),
      });

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, tenantName);

      const supportOrigin = new URL(tenant.host).origin;

      await enterSupportModeFromListFlow(page, tenant.id);

      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`^${escapeRegExp(supportOrigin)}/courses$`));

      await page.goto(`${supportOrigin}/settings`);

      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toHaveCount(0);
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_CONTENT)).toBeVisible();
    },
    { root: true },
  );
});
