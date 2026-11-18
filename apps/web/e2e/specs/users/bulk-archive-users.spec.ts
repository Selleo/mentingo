import { USER_ROLE } from "~/config/userRoles";

import { USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkEditFlow } from "../../flows/users/confirm-bulk-edit.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openBulkEditActionFlow } from "../../flows/users/open-bulk-edit-action.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { selectUsersFlow } from "../../flows/users/select-users.flow";

test("admin can bulk archive a mixed selection of active and already archived users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-archive-mixed-${Date.now()}`;
    const activeUsers = await userFactory.createMany(2, (index) => ({
      email: `${prefix}-active-${index}@example.com`,
    }));
    const archivedUser = await userFactory.create({ email: `${prefix}-archived@example.com` });
    const users = [...activeUsers, archivedUser];

    cleanup.add(async () => {
      await userFactory.deleteMany(users.map((user) => user.id));
    });

    await userFactory.update(archivedUser.id, { archived: true });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: prefix, archivedStatus: "all" });
    await selectUsersFlow(
      page,
      users.map((user) => user.id),
    );
    await openBulkEditActionFlow(page, "archive");
    await confirmBulkEditFlow(page);

    await expect
      .poll(async () => {
        const updatedUsers = await Promise.all(users.map((user) => userFactory.getById(user.id)));
        return updatedUsers.every((user) => user.archived);
      })
      .toBe(true);

    await filterUsersFlow(page, { archivedStatus: "active" });
    for (const user of users) {
      await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toHaveCount(0);
    }

    await filterUsersFlow(page, { archivedStatus: "archived" });
    for (const user of users) {
      await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toBeVisible();
    }
  });
});
