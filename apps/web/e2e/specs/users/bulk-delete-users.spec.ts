import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { USER_BULK_EDIT_MODAL_HANDLES, USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmBulkEditFlow } from "../../flows/users/confirm-bulk-edit.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openBulkEditActionFlow } from "../../flows/users/open-bulk-edit-action.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { selectUsersFlow } from "../../flows/users/select-users.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";
import { createDisposableAdminSession } from "../../utils/create-disposable-admin-session";

test("admin can bulk delete selected student users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-delete-${Date.now()}`;
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
    await openBulkEditActionFlow(page, "delete");
    await confirmBulkEditFlow(page);

    await expect(page.getByTestId(USERS_PAGE_HANDLES.TABLE_BODY).getByRole("row")).toHaveCount(0);

    await expect
      .poll(async () => Promise.all(users.map((user) => userFactory.getByEmail(user.email))))
      .toEqual([null, null]);
  });
});

test("admin cannot bulk delete non-student users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-delete-guard-${Date.now()}`;
    const studentUser = await userFactory.create({
      email: `${prefix}-student@example.com`,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
    });
    const contentCreatorUser = await userFactory.create({
      email: `${prefix}-creator@example.com`,
      roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
    });

    cleanup.add(async () => {
      await userFactory.deleteMany([studentUser.id, contentCreatorUser.id]);
    });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: prefix });
    await selectUsersFlow(page, [studentUser.id, contentCreatorUser.id]);
    await openBulkEditActionFlow(page, "delete");
    await confirmBulkEditFlow(page);

    await assertToastVisible(page, "You can only delete students");
    await expect
      .poll(async () => {
        const [existingStudent, existingCreator] = await Promise.all([
          userFactory.getById(studentUser.id),
          userFactory.getById(contentCreatorUser.id),
        ]);

        return Boolean(existingStudent) && Boolean(existingCreator);
      })
      .toBe(true);
  });
});

test("admin cannot bulk delete themselves", async ({
  browser,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-delete-self-${Date.now()}`;
    const studentUser = await userFactory.create({
      email: `${prefix}-student@example.com`,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
    });
    const { page, user: disposableAdmin } = await createDisposableAdminSession({
      browser,
      cleanup,
      userFactory,
      email: `${prefix}-admin@example.com`,
    });

    cleanup.add(async () => {
      await userFactory.delete(studentUser.id);
    });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: prefix });
    await selectUsersFlow(page, [studentUser.id, disposableAdmin.id]);
    await openBulkEditActionFlow(page, "delete");
    await confirmBulkEditFlow(page);

    await assertToastVisible(page, "You cannot delete yourself", { optional: true });
    await expect(page.getByTestId(USER_BULK_EDIT_MODAL_HANDLES.DIALOG)).toBeVisible();
    await expect
      .poll(async () => {
        const [existingStudent, existingAdmin] = await Promise.all([
          userFactory.getById(studentUser.id),
          userFactory.getById(disposableAdmin.id),
        ]);

        return Boolean(existingStudent) && Boolean(existingAdmin);
      })
      .toBe(true);
  });
});
