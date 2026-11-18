import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { USER_PAGE_HANDLES, USERS_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillUserFormFlow } from "../../flows/users/fill-user-form.flow";
import { filterUsersFlow } from "../../flows/users/filter-users.flow";
import { openUserPageFlow } from "../../flows/users/open-user-page.flow";
import { openUsersPageFlow } from "../../flows/users/open-users-page.flow";
import { saveUserFormFlow } from "../../flows/users/save-user-form.flow";

test("admin can update a user's details, roles and groups, then archive the user", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const groupFactory = factories.createGroupFactory();
    const user = await userFactory.create();
    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });
    const group = await groupFactory.create();
    cleanup.add(async () => {
      await groupFactory.delete(group.id);
    });
    const updatedEmail = `updated-user-${Date.now()}@example.com`;

    await openUserPageFlow(page, user.id);
    await fillUserFormFlow(page, {
      firstName: "Updated",
      lastName: "Person",
      email: updatedEmail,
      roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
      groupIds: [group.id],
    });
    await saveUserFormFlow(page);

    await expect(page.getByTestId(USER_PAGE_HANDLES.FIRST_NAME_INPUT)).toHaveValue("Updated");
    await expect(page.getByTestId(USER_PAGE_HANDLES.LAST_NAME_INPUT)).toHaveValue("Person");
    await expect(page.getByTestId(USER_PAGE_HANDLES.EMAIL_INPUT)).toHaveValue(updatedEmail);
    await expect
      .poll(async () => {
        const updatedUser = await userFactory.getById(user.id);
        return {
          email: updatedUser.email,
          isContentCreator: updatedUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
          inGroup: updatedUser.groups.some((existingGroup) => existingGroup.id === group.id),
        };
      })
      .toEqual({ email: updatedEmail, isContentCreator: true, inGroup: true });

    await openUsersPageFlow(page);
    await filterUsersFlow(page, {
      keyword: updatedEmail,
      roleSlug: SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      groupIds: [group.id],
    });
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toBeVisible();

    await openUserPageFlow(page, user.id);
    await fillUserFormFlow(page, { archived: true });
    await saveUserFormFlow(page);
    await expect(page.getByTestId(USER_PAGE_HANDLES.STATUS_BADGE)).toHaveAttribute(
      "data-status",
      "archived",
    );
    await expect.poll(async () => (await userFactory.getById(user.id)).archived).toBe(true);

    await openUsersPageFlow(page);
    await filterUsersFlow(page, { keyword: updatedEmail });
    // The keyword matches only the archived user, so the loaded active list is empty.
    await expect(page.getByTestId(USERS_PAGE_HANDLES.EMPTY_STATE)).toBeVisible();
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toHaveCount(0);
    await filterUsersFlow(page, { archivedStatus: "archived" });
    await expect(page.getByTestId(USERS_PAGE_HANDLES.row(user.id))).toBeVisible();
  });
});
