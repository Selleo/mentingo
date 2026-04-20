import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { USERS_PAGE_HANDLES, USER_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openUserDetailsFromListFlow } from "../../flows/users/open-user-details-from-list.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { selectUsersFlow } from "../../flows/users/select-users.flow";

test("admin can browse, filter, sort, paginate, select, and open user details", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const groupFactory = factories.createGroupFactory();
    const prefix = `users-list-${Date.now()}`;

    const group = await groupFactory.create({ name: `${prefix}-group` });
    const users = await userFactory.createMany(11, (index) => ({
      firstName: index === 0 ? `${prefix}-Alpha` : `${prefix}-User-${index}`,
      lastName: "List",
      email: `${prefix}-${index}@example.com`,
      roleSlugs: index === 10 ? [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR] : [SYSTEM_ROLE_SLUGS.STUDENT],
    }));

    cleanup.add(async () => {
      await groupFactory.delete(group.id);
    });
    cleanup.add(async () => {
      await userFactory.deleteMany(users.map((user) => user.id));
    });

    await Promise.all(users.map((user) => userFactory.update(user.id, { groups: [group.id] })));

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { groupIds: [group.id] });

    const visibleRows = page.getByTestId(USERS_PAGE_HANDLES.TABLE_BODY).getByRole("row");

    await expect(visibleRows).toHaveCount(10);

    await page.getByTestId(USERS_PAGE_HANDLES.PAGINATION_NEXT).click();
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(users[10].id))).toBeVisible();

    await page.getByTestId(USERS_PAGE_HANDLES.PAGINATION_PREVIOUS).click();
    await page.getByTestId(USERS_PAGE_HANDLES.SORT_FIRST_NAME).click();

    await expect(visibleRows.first()).toHaveAttribute(
      "data-testid",
      USERS_PAGE_HANDLES.row(users[0].id),
    );

    await filterUsersFlow(page, {
      roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      keyword: users[10].email,
    });

    await expect(visibleRows).toHaveCount(1);
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(users[10].id))).toBeVisible();

    await selectUsersFlow(page, [users[10].id]);
    await expect(page.getByTestId(USERS_PAGE_HANDLES.rowCheckbox(users[10].id))).toHaveAttribute(
      "data-state",
      "checked",
    );

    await openUserDetailsFromListFlow(page, users[10].id);

    await expect(page).toHaveURL(new RegExp(`/admin/users/${users[10].id}$`));
    await expect(page.getByTestId(USER_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});
