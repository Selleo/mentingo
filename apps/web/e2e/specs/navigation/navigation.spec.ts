import { USER_ROLE } from "~/config/userRoles";

import {
  NAVIGATION_HANDLES,
  PROVIDER_INFORMATION_PAGE_HANDLES,
} from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { clickHandleAndExpectUrlFlow } from "../../flows/click-handle-and-expect-url.flow";
import { openManageMenuFlow } from "../../flows/navigation/open-manage-menu.flow";
import { openProfileMenuFlow } from "../../flows/navigation/open-profile-menu.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";

const ROLE_NAVIGATION_EXPECTATIONS = [
  {
    role: USER_ROLE.admin,
    title: "admin",
    canSeeManage: true,
  },
  {
    role: USER_ROLE.contentCreator,
    title: "content creator",
    canSeeManage: false,
  },
  {
    role: USER_ROLE.student,
    title: "student",
    canSeeManage: false,
  },
] as const;

for (const { role, title, canSeeManage } of ROLE_NAVIGATION_EXPECTATIONS) {
  test(`${title} can navigate the sidebar`, async ({ withWorkerPage }) => {
    await withWorkerPage(role, async ({ page }) => {
      await prepareNavigationPageFlow(page);
      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

      await expect(page.getByTestId(NAVIGATION_HANDLES.COURSES_LINK)).toHaveAttribute(
        "aria-current",
        "page",
      );

      if (canSeeManage) {
        await openManageMenuFlow(page);

        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.USERS_LINK, "/admin/users");
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

        await openManageMenuFlow(page);
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.GROUPS_LINK, "/admin/groups");
        await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

        await openManageMenuFlow(page);
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

  test(`${title} can use the profile menu`, async ({ apiClient, withWorkerPage }) => {
    await withWorkerPage(role, async ({ page }) => {
      const currentUser = await apiClient.api.authControllerCurrentUser();

      await prepareNavigationPageFlow(page);
      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");

      await openProfileMenuFlow(page, NAVIGATION_HANDLES.PROVIDER_INFORMATION_LINK);
      await clickHandleAndExpectUrlFlow(
        page,
        NAVIGATION_HANDLES.PROVIDER_INFORMATION_LINK,
        "/provider-information",
      );
      await expect(page.getByTestId(PROVIDER_INFORMATION_PAGE_HANDLES.HEADING)).toBeVisible();

      await openProfileMenuFlow(page, NAVIGATION_HANDLES.PROFILE_LINK);
      await clickHandleAndExpectUrlFlow(
        page,
        NAVIGATION_HANDLES.PROFILE_LINK,
        new RegExp(`/profile/${currentUser.data.data.id}$`),
      );

      await openProfileMenuFlow(page, NAVIGATION_HANDLES.SETTINGS_LINK);
      await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.SETTINGS_LINK, "/settings");
      await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.TABS)).toBeVisible();
    });
  });
}
