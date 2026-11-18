import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { SUPPORT_MODE_HANDLES } from "../../data/support-mode/handles";
import { TENANTS_PAGE_HANDLES } from "../../data/tenants/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { enterSupportModeAsUserFlow } from "../../flows/tenants/enter-support-mode-as-user.flow";
import { enterSupportModeFromListFlow } from "../../flows/tenants/enter-support-mode-from-list.flow";
import { filterTenantsFlow } from "../../flows/tenants/filter-tenants.flow";
import { openTenantsPageFlow } from "../../flows/tenants/open-tenants-page.flow";
import { buildLmsLocalhostTenantHost, requireOrigin } from "../../utils/tenant-host";

test("managing admin can enter support mode, is limited inside it and can exit", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ origin, page }) => {
      const originalOrigin = requireOrigin(origin);
      const tenantFactory = factories.createTenantFactory();
      const tenantName = `support-mode-${Date.now()}`;
      const tenant = await tenantFactory.create({
        name: tenantName,
        host: buildLmsLocalhostTenantHost(originalOrigin, tenantName),
      });

      cleanup.add(async () => {
        await tenantFactory.deactivate(tenant.id);
      });

      const supportOrigin = new URL(tenant.host).origin;

      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, tenantName);
      await enterSupportModeFromListFlow(page, tenant.id);

      await expect(page).toHaveURL(`${supportOrigin}/dashboard`);
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeVisible();
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.MESSAGE)).toBeVisible();
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.TIME_LEFT)).toBeVisible();
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.EXIT_BUTTON)).toBeVisible();
      await expect(page.getByTestId(NAVIGATION_HANDLES.SUPER_ADMIN_GROUP)).toHaveCount(0);

      await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
      await expect(page.getByTestId(NAVIGATION_HANDLES.PROFILE_LINK)).toHaveCount(0);

      await page.goto(`${supportOrigin}/settings`);
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ACCOUNT_TAB)).toHaveCount(0);
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_TAB)).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.ORGANIZATION_CONTENT)).toBeVisible();

      const supportExitNavigation = page.waitForURL((url) => url.origin === originalOrigin);
      await page.getByTestId(SUPPORT_MODE_HANDLES.EXIT_BUTTON).click();
      await supportExitNavigation;

      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toHaveCount(0);

      await openTenantsPageFlow(page);
      await expect(page).toHaveURL(`${originalOrigin}/super-admin/tenants`);
      await expect(page.getByTestId(TENANTS_PAGE_HANDLES.PAGE)).toBeVisible();
    },
    { root: true },
  );
});

test("managing admin can impersonate a non-admin user from all users", async ({
  createIsolatedWorkspace,
  withWorkerPage,
}) => {
  const tenantSlug = Date.now();
  const tenantName = `support-mode-user-${tenantSlug}`;
  const workspace = await createIsolatedWorkspace({
    role: USER_ROLE.admin,
    tenant: { name: tenantName },
  });
  const studentEmail = `support-mode-student-${tenantSlug}@example.com`;
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    email: studentEmail,
    role: USER_ROLE.student,
  });

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await openTenantsPageFlow(page);
      await filterTenantsFlow(page, tenantName);
      await enterSupportModeAsUserFlow(page, {
        tenantId: workspace.tenant.id,
        userEmail: studentEmail,
        userId: studentSession.user.id,
      });

      await expect(page).toHaveURL(`${workspace.origin}/dashboard`);
      await expect(page.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeVisible();
      await expect(page.getByTestId(NAVIGATION_HANDLES.USERS_LINK)).toHaveCount(0);

      await page.goto(`${workspace.origin}/settings`);
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.NO_AVAILABLE_SETTINGS)).toBeVisible();
    },
    { root: true },
  );
});
