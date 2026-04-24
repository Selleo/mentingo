import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { USER_BULK_EDIT_MODAL_HANDLES, USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkEditFlow } from "../../flows/users/confirm-bulk-edit.flow";
import { fillBulkUserRolesFlow } from "../../flows/users/fill-bulk-user-roles.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openBulkEditActionFlow } from "../../flows/users/open-bulk-edit-action.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { selectUsersFlow } from "../../flows/users/select-users.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";
import { createDisposableAdminSession } from "../../utils/create-disposable-admin-session";

test("admin cannot open bulk edit actions without selecting users", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openUsersPageFlow(page);

    await expect(page.getByTestId(USERS_PAGE_HANDLES.BULK_EDIT_TRIGGER)).toBeDisabled();
  });
});

test("admin cannot submit a bulk role update without choosing a role", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const student = await userFactory.create({
      email: `bulk-role-no-choice-${Date.now()}@example.com`,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
    });

    cleanup.add(async () => {
      await userFactory.delete(student.id);
    });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: student.email });
    await selectUsersFlow(page, [student.id]);
    await openBulkEditActionFlow(page, "role");

    await expect(page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.SUBMIT_BUTTON)).toBeDisabled();
  });
});

test("admin can bulk update roles for selected users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-roles-${Date.now()}`;
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
    await openBulkEditActionFlow(page, "role");
    await fillBulkUserRolesFlow(page, {
      roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
    });
    await confirmBulkEditFlow(page, { requireConfirmation: true });

    await expect
      .poll(async () => {
        const updatedUsers = await Promise.all(users.map((user) => userFactory.getById(user.id)));

        return updatedUsers.every((user) =>
          user.roleSlugs.includes(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
        );
      })
      .toBe(true);
  });
});

test("admin cannot bulk update their own role", async ({
  browser,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-roles-self-${Date.now()}`;
    const { page, user: disposableAdmin } = await createDisposableAdminSession({
      browser,
      cleanup,
      userFactory,
      email: `${prefix}-admin@example.com`,
    });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: disposableAdmin.email });
    await selectUsersFlow(page, [disposableAdmin.id]);
    await openBulkEditActionFlow(page, "role");
    await fillBulkUserRolesFlow(page, {
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
    });
    await confirmBulkEditFlow(page, { requireConfirmation: true });

    await assertToastVisible(page, "Administrator cannot change their own role");
    await expect
      .poll(async () => {
        const existingAdmin = await userFactory.getById(disposableAdmin.id);

        return existingAdmin.roleSlugs.includes(SYSTEM_ROLE_SLUGS.ADMIN);
      })
      .toBe(true);
  });
});
