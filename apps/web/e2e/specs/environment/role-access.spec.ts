import { USER_ROLE } from "~/config/userRoles";

import { ENV_PAGE_HANDLES } from "../../data/environment/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEnvironmentPageFlow } from "../../flows/environment/open-environment-page.flow";

const BLOCKED_ROLES = [
  { role: USER_ROLE.contentCreator, title: "content creator" },
  { role: USER_ROLE.student, title: "student" },
] as const;

test.setTimeout(180 * 1000);

test("admin can access environment management", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openEnvironmentPageFlow(page);
  });
});

for (const { role, title } of BLOCKED_ROLES) {
  test(`${title} cannot access environment management`, async ({ withReadonlyPage }) => {
    await withReadonlyPage(role, async ({ page }) => {
      await page.goto("/admin/envs");

      await expect(page).not.toHaveURL(/\/admin\/envs$/);
      await expect(page.getByTestId(ENV_PAGE_HANDLES.PAGE)).toHaveCount(0);
    });
  });
}
