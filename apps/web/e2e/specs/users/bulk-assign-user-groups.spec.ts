import { USER_ROLE } from "~/config/userRoles";

import { USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkEditFlow } from "../../flows/users/confirm-bulk-edit.flow";
import { fillBulkUserGroupsFlow } from "../../flows/users/fill-bulk-user-groups.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openBulkEditActionFlow } from "../../flows/users/open-bulk-edit-action.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { selectUsersFlow } from "../../flows/users/select-users.flow";

test("admin can bulk update groups for selected users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const groupFactory = factories.createGroupFactory();
    const prefix = `bulk-groups-${Date.now()}`;
    const removableGroup = await groupFactory.create({ name: `${prefix}-remove` });
    const assignedGroup = await groupFactory.create({ name: `${prefix}-assign` });
    const users = await userFactory.createMany(2, (index) => ({
      email: `${prefix}-${index}@example.com`,
    }));

    cleanup.add(async () => {
      await groupFactory.delete(assignedGroup.id);
    });
    cleanup.add(async () => {
      await groupFactory.delete(removableGroup.id);
    });
    cleanup.add(async () => {
      await userFactory.deleteMany(users.map((user) => user.id));
    });

    await Promise.all(
      users.map((user) =>
        userFactory.update(user.id, {
          groups: [removableGroup.id],
        }),
      ),
    );

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: prefix });
    await selectUsersFlow(
      page,
      users.map((user) => user.id),
    );
    await openBulkEditActionFlow(page, "group");
    await fillBulkUserGroupsFlow(page, {
      groupIds: [removableGroup.id, assignedGroup.id],
    });
    await confirmBulkEditFlow(page, { requireConfirmation: true });

    await filterUsersFlow(page, {
      clearAll: true,
      keyword: prefix,
      groupIds: [assignedGroup.id],
    });

    for (const user of users) {
      await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toBeVisible();
    }

    await expect
      .poll(async () => {
        const updatedUsers = await Promise.all(users.map((user) => userFactory.getById(user.id)));

        return updatedUsers.every(
          (user) =>
            user.groups.some((group) => group.id === assignedGroup.id) &&
            user.groups.every((group) => group.id !== removableGroup.id),
        );
      })
      .toBe(true);
  });
});
