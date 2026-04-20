import { SYSTEM_ROLE_SLUGS, SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CREATE_USER_PAGE_HANDLES, USER_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateUserFormFlow } from "../../flows/users/fill-create-user-form.flow";
import { openCreateUserPageFlow } from "../../flows/users/open-create-user-page.flow";
import { submitCreateUserFormFlow } from "../../flows/users/submit-create-user-form.flow";
import { assertToastVisible } from "../../utils/assert-toast-visible";

test("admin can create a user from the create page", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `create-user-${Date.now()}@example.com`;

    await openCreateUserPageFlow(page);
    await fillCreateUserFormFlow(page, {
      firstName: "Create",
      lastName: "User",
      email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      language: SUPPORTED_LANGUAGES.EN,
    });
    await submitCreateUserFormFlow(page);

    await expect
      .poll(async () => {
        const createdUser = await userFactory.getByEmail(email);
        return createdUser?.id ?? null;
      })
      .not.toBeNull();

    const createdUser = await userFactory.getByEmail(email);

    cleanup.add(async () => {
      if (createdUser) {
        await userFactory.delete(createdUser.id);
      }
    });

    await expect(page).toHaveURL(new RegExp(`/admin/users/${createdUser?.id}$`));
    await expect(page.getByTestId(USER_PAGE_HANDLES.EMAIL_INPUT)).toHaveValue(email);
  });
});

test("admin cannot submit invalid user data", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openCreateUserPageFlow(page);

    await expect(page.getByTestId(CREATE_USER_PAGE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();

    await fillCreateUserFormFlow(page, {
      firstName: "A",
      lastName: "B",
      email: "not-an-email",
    });

    await expect(page.getByTestId(CREATE_USER_PAGE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();
  });
});

test("admin sees a conflict when creating a duplicate email", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const existingUser = await userFactory.create({
      email: `duplicate-user-${Date.now()}@example.com`,
    });

    cleanup.add(async () => {
      await userFactory.delete(existingUser.id);
    });

    await openCreateUserPageFlow(page);
    await fillCreateUserFormFlow(page, {
      firstName: "Duplicate",
      lastName: "User",
      email: existingUser.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      language: SUPPORTED_LANGUAGES.EN,
    });
    await submitCreateUserFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/users\/new$/);
    await assertToastVisible(page, "User already exists");
  });
});
