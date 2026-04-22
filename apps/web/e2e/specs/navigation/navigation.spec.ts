import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { clickHandleAndExpectUrlFlow } from "../../flows/click-handle-and-expect-url.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";

import type { Page } from "@playwright/test";

type RoleNavigationExpectation = {
  role: USER_ROLE;
  title: string;
  canSeeAnalytics: boolean;
  canSeeManage: boolean;
};

const ROLE_NAVIGATION_EXPECTATIONS: RoleNavigationExpectation[] = [
  {
    role: USER_ROLE.admin,
    title: "admin",
    canSeeAnalytics: true,
    canSeeManage: true,
  },
  {
    role: USER_ROLE.contentCreator,
    title: "content creator",
    canSeeAnalytics: true,
    canSeeManage: false,
  },
  {
    role: USER_ROLE.student,
    title: "student",
    canSeeAnalytics: false,
    canSeeManage: false,
  },
];

const openManageMenu = async (page: Page) => {
  const usersLink = page.getByTestId(NAVIGATION_HANDLES.USERS_LINK);

  if (await usersLink.isVisible()) return;

  await page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE).click();
  await expect(usersLink).toBeVisible();
};

for (const { role, title, canSeeAnalytics, canSeeManage } of ROLE_NAVIGATION_EXPECTATIONS) {
  test(`${title} can navigate the sidebar`, async ({ withReadonlyPage }) => {
    await withReadonlyPage(role, async ({ page }) => {
      await prepareNavigationPageFlow(page);
      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

      await expect(page.getByTestId(NAVIGATION_HANDLES.COURSES_LINK)).toHaveAttribute(
        "aria-current",
        "page",
      );

      if (canSeeAnalytics) {
        await clickHandleAndExpectUrlFlow(
          page,
          NAVIGATION_HANDLES.ANALYTICS_LINK,
          "/admin/analytics",
        );
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");
      } else {
        await expect(page.getByTestId(NAVIGATION_HANDLES.ANALYTICS_LINK)).toHaveCount(0);
      }

      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.PROGRESS_LINK, "/progress");

      if (canSeeManage) {
        await openManageMenu(page);

        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.USERS_LINK, "/admin/users");
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

        await openManageMenu(page);
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.GROUPS_LINK, "/admin/groups");
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

        await openManageMenu(page);
        await clickHandleAndExpectUrlFlow(
          page,
          NAVIGATION_HANDLES.CATEGORIES_LINK,
          "/admin/categories",
        );
      } else {
        await expect(page.getByTestId(NAVIGATION_HANDLES.MANAGE_TOGGLE)).toHaveCount(0);
      }
    });
  });

  test(`${title} can use the profile menu`, async ({ apiClient, withReadonlyPage }) => {
    await withReadonlyPage(role, async ({ page }) => {
      const currentUser = await apiClient.api.authControllerCurrentUser();

      await prepareNavigationPageFlow(page);
      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

      await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
      await clickHandleAndExpectUrlFlow(
        page,
        NAVIGATION_HANDLES.PROVIDER_INFORMATION_LINK,
        "/provider-information",
      );
      await expect(page.locator("#provider-information")).toBeVisible();

      await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
      await clickHandleAndExpectUrlFlow(
        page,
        NAVIGATION_HANDLES.PROFILE_LINK,
        new RegExp(`/profile/${currentUser.data.data.id}$`),
      );

      await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.SETTINGS_LINK, "/settings");
      await expect(page.locator("#settings-tabs")).toBeVisible();
    });
  });
}
