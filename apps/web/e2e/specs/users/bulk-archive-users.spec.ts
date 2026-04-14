import { USER_ROLE } from "~/config/userRoles";

import { USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkEditFlow } from "../../flows/users/confirm-bulk-edit.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openBulkEditActionFlow } from "../../flows/users/open-bulk-edit-action.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { selectUsersFlow } from "../../flows/users/select-users.flow";

test("admin can bulk archive active users", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-archive-${Date.now()}`;
    const users = await userFactory.createMany(2, (index) => ({
      email: `${prefix}-${index}@example.com`,
    }));

    cleanup.add(async () => {
      await userFactory.deleteMany(users.map((user) => user.id));
    });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: prefix });
    await selectUsersFlow(
      page,
      users.map((user) => user.id),
    );
    await openBulkEditActionFlow(page, "archive");
    await confirmBulkEditFlow(page);

    await expect(page.getByTestId(USERS_PAGE_HANDLES.TABLE_BODY).getByRole("row")).toHaveCount(0);

    await filterUsersFlow(page, { archivedStatus: "archived" });

    for (const user of users) {
      await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toBeVisible();
    }

    await expect
      .poll(async () => {
        const archivedUsers = await Promise.all(users.map((user) => userFactory.getById(user.id)));
        return archivedUsers.every((user) => user.archived);
      })
      .toBe(true);
  });
});

test("admin can bulk archive a mixed selection of active and already archived users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-archive-mixed-${Date.now()}`;
    const activeUser = await userFactory.create({ email: `${prefix}-active@example.com` });
    const archivedUser = await userFactory.create({ email: `${prefix}-archived@example.com` });

    await userFactory.update(archivedUser.id, { archived: true });

    cleanup.add(async () => {
      await userFactory.deleteMany([activeUser.id, archivedUser.id]);
    });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: prefix, archivedStatus: "all" });
    await selectUsersFlow(page, [activeUser.id, archivedUser.id]);
    await openBulkEditActionFlow(page, "archive");
    await confirmBulkEditFlow(page);

    await expect
      .poll(async () => {
        const updatedUsers = await Promise.all([
          userFactory.getById(activeUser.id),
          userFactory.getById(archivedUser.id),
        ]);

        return updatedUsers.every((user) => user.archived);
      })
      .toBe(true);

    await filterUsersFlow(page, { archivedStatus: "archived" });
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(activeUser.id))).toBeVisible();
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(archivedUser.id))).toBeVisible();
  });
});
