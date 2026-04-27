import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { MFA_PAGE_HANDLES } from "../../data/auth/handles";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillMfaTokenFlow } from "../../flows/auth/fill-mfa-token.flow";
import { submitMfaTokenFlow } from "../../flows/auth/submit-mfa-token.flow";
import { generateTotpToken } from "../../utils/totp";

const INITIAL_PASSWORD = "Password123@";

test("admin can enable MFA and verify it on login", async ({
  cleanup,
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const userFactory = workspace.factories.createUserFactory();
  const email = `mfa-${Date.now()}@example.com`;

  const user = await userFactory.register({
    email,
    firstName: "MFA",
    lastName: "User",
    password: INITIAL_PASSWORD,
  });

  cleanup.add(async () => {
    await userFactory.delete(user.id);
  });
  cleanup.add(async () => {
    await workspace.apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
      [SYSTEM_ROLE_SLUGS.ADMIN]: false,
    });
  });

  await userFactory.update(user.id, { roleSlugs: [USER_ROLE.admin] });
  await workspace.apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
    [SYSTEM_ROLE_SLUGS.ADMIN]: true,
  });

  await logout(workspace.page, { origin: workspace.origin });

  await login(workspace.page, email, INITIAL_PASSWORD, { origin: workspace.origin });
  await expect(workspace.page).toHaveURL(`${workspace.origin}/auth/mfa`);
  await expect(workspace.page.getByTestId(MFA_PAGE_HANDLES.PAGE)).toBeVisible();

  const secret = (await workspace.page.getByTestId(MFA_PAGE_HANDLES.SECRET).textContent())?.trim();

  if (!secret) throw new Error("Expected MFA setup secret to be visible");

  await fillMfaTokenFlow(workspace.page, generateTotpToken(secret));
  await submitMfaTokenFlow(workspace.page);

  await expect(workspace.page).toHaveURL(`${workspace.origin}/courses`);

  await logout(workspace.page, { origin: workspace.origin });
  await login(workspace.page, email, INITIAL_PASSWORD, { origin: workspace.origin });
  await expect(workspace.page).toHaveURL(`${workspace.origin}/auth/mfa`);
  await expect(workspace.page.getByTestId(MFA_PAGE_HANDLES.PAGE)).toBeVisible();

  await fillMfaTokenFlow(workspace.page, generateTotpToken(secret));
  await submitMfaTokenFlow(workspace.page);

  await expect(workspace.page).toHaveURL(`${workspace.origin}/courses`);
});
