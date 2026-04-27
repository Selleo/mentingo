import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { MFA_PAGE_HANDLES } from "../../data/auth/handles";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { fillMfaTokenFlow } from "../../flows/auth/fill-mfa-token.flow";
import { submitMfaTokenFlow } from "../../flows/auth/submit-mfa-token.flow";
import { generateTotpToken } from "../../utils/totp";

const INITIAL_PASSWORD = "Password123@";

test("admin can enable MFA and verify it on login", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const email = `mfa-${Date.now()}@example.com`;

  const adminSession = await workspace.createTenantUserWithPasswordAndRole({
    email,
    firstName: "MFA",
    lastName: "User",
    password: INITIAL_PASSWORD,
    role: USER_ROLE.admin,
  });
  const { page } = adminSession;

  await logout(page, { origin: workspace.origin });

  await workspace.apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
    [SYSTEM_ROLE_SLUGS.ADMIN]: true,
  });

  await login(page, email, INITIAL_PASSWORD, { origin: workspace.origin });
  await expect(page).toHaveURL(`${workspace.origin}/auth/mfa`);
  await expect(page.getByTestId(MFA_PAGE_HANDLES.PAGE)).toBeVisible();

  const secret = (await page.getByTestId(MFA_PAGE_HANDLES.SECRET).textContent())?.trim();

  if (!secret) throw new Error("Expected MFA setup secret to be visible");

  await fillMfaTokenFlow(page, generateTotpToken(secret));
  await submitMfaTokenFlow(page);

  await expect(page).toHaveURL(`${workspace.origin}/courses`);

  await logout(page, { origin: workspace.origin });
  await login(page, email, INITIAL_PASSWORD, { origin: workspace.origin });
  await expect(page).toHaveURL(`${workspace.origin}/auth/mfa`);

  await expect(page.getByTestId(MFA_PAGE_HANDLES.PAGE)).toBeVisible();

  await fillMfaTokenFlow(page, generateTotpToken(secret));
  await submitMfaTokenFlow(page);

  await expect(page).toHaveURL(`${workspace.origin}/courses`);
});
