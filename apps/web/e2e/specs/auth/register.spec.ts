import { USER_ROLE } from "~/config/userRoles";

import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillRegisterFormFlow } from "../../flows/auth/fill-register-form.flow";
import { openRegisterPageFlow } from "../../flows/auth/open-register-page.flow";
import { submitRegisterFormFlow } from "../../flows/auth/submit-register-form.flow";

const REGISTER_PASSWORD = "Password123@";

test("visitor can register a new account", async ({ cleanup, factories, withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const userFactory = factories.createUserFactory();
    const email = `register-${Date.now()}@example.com`;

    await openRegisterPageFlow(page);
    await fillRegisterFormFlow(page, {
      firstName: "Register",
      lastName: "User",
      email,
      password: REGISTER_PASSWORD,
    });
    await submitRegisterFormFlow(page);

    await expect
      .poll(async () => {
        const createdUser = await userFactory.getByEmail(email);
        return createdUser?.id ?? null;
      })
      .not.toBeNull();

    cleanup.add(async () => {
      const createdUser = await userFactory.getByEmail(email);

      if (createdUser) await userFactory.delete(createdUser.id);
    });

    const createdUser = await userFactory.getByEmail(email);

    if (!createdUser) throw new Error(`Expected registered user ${email} to exist`);

    await expect(page).toHaveURL("/courses");
    await logout(page);
    await login(page, email, REGISTER_PASSWORD);
    await expect(page).toHaveURL("/courses");
  });
});

test("visitor cannot submit invalid registration data", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openRegisterPageFlow(page);

    await fillRegisterFormFlow(page, {
      firstName: "A",
      lastName: "B",
      email: "not-an-email",
      password: "short",
    });

    await expect(page.getByTestId(REGISTER_PAGE_HANDLES.SUBMIT)).toBeDisabled();
  });
});
