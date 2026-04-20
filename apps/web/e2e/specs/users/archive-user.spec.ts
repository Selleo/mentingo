import { USER_ROLE } from "~/config/userRoles";

import { USERS_PAGE_HANDLES, USER_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillUserFormFlow } from "../../flows/users/fill-user-form.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openUserPageFlow } from "../../flows/users/open-user-page.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { saveUserFormFlow } from "../../flows/users/save-user-form.flow";

test("admin can archive a user from the details page", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const user = await userFactory.create();

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openUserPageFlow(page, user.id);
    await fillUserFormFlow(page, { archived: true });
    await saveUserFormFlow(page);

    await expect(page.getByTestId(USER_PAGE_HANDLES.STATUS_BADGE)).toContainText("Archived");
    await expect
      .poll(async () => {
        const archivedUser = await userFactory.getById(user.id);
        return archivedUser.archived;
      })
      .toBe(true);

    await openUsersPageFlow(page);
    await filterUsersFlow(page, {
      keyword: user.email,
      archivedStatus: "archived",
    });
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toBeVisible();
  });
});
