import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { USER_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillUserFormFlow } from "../../flows/users/fill-user-form.flow";
import { openUserPageFlow } from "../../flows/users/open-user-page.flow";
import { saveUserFormFlow } from "../../flows/users/save-user-form.flow";

test("admin can update a user's basic fields", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const user = await userFactory.create();
    const updatedEmail = `updated-user-${Date.now()}@example.com`;

    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openUserPageFlow(page, user.id);
    await fillUserFormFlow(page, {
      firstName: "Updated",
      lastName: "Person",
      email: updatedEmail,
    });
    await saveUserFormFlow(page);

    await expect(page.getByTestId(USER_PAGE_HANDLES.FIRST_NAME_INPUT)).toHaveValue("Updated");
    await expect(page.getByTestId(USER_PAGE_HANDLES.LAST_NAME_INPUT)).toHaveValue("Person");
    await expect(page.getByTestId(USER_PAGE_HANDLES.EMAIL_INPUT)).toHaveValue(updatedEmail);

    await expect
      .poll(async () => {
        const updatedUser = await userFactory.getByEmail(updatedEmail);

        return (
          updatedUser?.id === user.id &&
          updatedUser.firstName === "Updated" &&
          updatedUser.lastName === "Person" &&
          updatedUser.email === updatedEmail
        );
      })
      .toBe(true);
  });
});

test("admin can update a user's roles and groups", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const groupFactory = factories.createGroupFactory();
    const user = await userFactory.create();
    const group = await groupFactory.create();

    cleanup.add(async () => {
      await groupFactory.delete(group.id);
    });
    cleanup.add(async () => {
      await userFactory.delete(user.id);
    });

    await openUserPageFlow(page, user.id);
    await fillUserFormFlow(page, {
      roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
      groupIds: [group.id],
    });
    await saveUserFormFlow(page);

    await expect(page.getByTestId(USER_PAGE_HANDLES.ROLE_SELECT)).toContainText(/Content creator/i);
    await expect(page.getByTestId(USER_PAGE_HANDLES.GROUPS_SELECT)).toContainText(group.name);

    await expect
      .poll(async () => {
        const updatedUser = await userFactory.getById(user.id);

        return (
          updatedUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR) &&
          updatedUser.groups.some((existingGroup) => existingGroup.id === group.id)
        );
      })
      .toBe(true);
  });
});
