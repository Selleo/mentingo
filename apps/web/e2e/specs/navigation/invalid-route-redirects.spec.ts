import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";

type ForbiddenRouteRedirectCase = {
  role: USER_ROLE;
  title: string;
  path: string;
};

const FORBIDDEN_ROUTE_REDIRECT_CASES: ForbiddenRouteRedirectCase[] = [
  {
    role: USER_ROLE.student,
    title: "student",
    path: "/admin/envs",
  },
  {
    role: USER_ROLE.student,
    title: "student",
    path: "/admin/analytics",
  },
  {
    role: USER_ROLE.student,
    title: "student",
    path: "/admin/promotion-codes",
  },
  {
    role: USER_ROLE.contentCreator,
    title: "content creator",
    path: "/admin/envs",
  },
  {
    role: USER_ROLE.contentCreator,
    title: "content creator",
    path: "/admin/users",
  },
  {
    role: USER_ROLE.contentCreator,
    title: "content creator",
    path: "/admin/promotion-codes",
  },
  {
    role: USER_ROLE.student,
    title: "student",
    path: "/super-admin/tenants",
  },
  {
    role: USER_ROLE.contentCreator,
    title: "content creator",
    path: "/super-admin/tenants",
  },
];

for (const { role, title, path } of FORBIDDEN_ROUTE_REDIRECT_CASES) {
  test(`${title} is redirected from ${path} to courses`, async ({ withReadonlyPage }) => {
    await withReadonlyPage(role, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL("/courses");
    });
  });
}
