import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { MFA_PAGE_HANDLES } from "../../data/auth/handles";
import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { login, logout } from "../../fixtures/auth.actions";
import { expect, test } from "../../fixtures/test.fixture";
import { readMfaSetupSecretFlow } from "../../flows/auth/read-mfa-setup-secret.flow";
import { verifyMfaCodeFlow } from "../../flows/auth/verify-mfa-code.flow";
import { openPathAtOriginFlow } from "../../flows/navigation/open-path-at-origin.flow";
import { generateTotpToken } from "../../utils/totp";

test("user can enroll in enforced MFA and verify it on login", async ({
  cleanup,
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const userFactory = workspace.factories.createUserFactory();
  const email = `mfa-${Date.now()}@example.com`;

  const learner = await workspace.createTenantUserWithPasswordAndRole({
    email,
    firstName: "MFA",
    lastName: "User",
    password: TEST_PASSWORD,
    role: USER_ROLE.student,
  });
  const { page, origin } = learner;

  cleanup.add(async () => {
    await userFactory.delete(learner.user.id);
  });

  cleanup.add(async () => {
    await workspace.apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
      [SYSTEM_ROLE_SLUGS.STUDENT]: false,
    });
  });

  await workspace.apiClient.api.settingsControllerUpdateMfaEnforcedRoles({
    [SYSTEM_ROLE_SLUGS.STUDENT]: true,
  });

  await logout(page, { origin });
  await login(page, email, TEST_PASSWORD, { origin });
  await expect(page).toHaveURL(`${origin}/auth/mfa`);
  await expect(page.getByTestId(MFA_PAGE_HANDLES.PAGE)).toBeVisible();

  const secret = await readMfaSetupSecretFlow(page);

  await page.reload();
  await expect(page.getByTestId(MFA_PAGE_HANDLES.SECRET)).toHaveText(secret);

  // A forged client-side "verified" flag must not bypass the server-side MFA challenge.
  await page.evaluate(() => {
    localStorage.setItem(
      "current-user-storage",
      JSON.stringify({ state: { hasVerifiedMFA: true } }),
    );
  });
  await openPathAtOriginFlow(page, origin, "/courses");
  await expect(page).toHaveURL(`${origin}/auth/mfa`);

  const enrollmentCode = generateTotpToken(secret);
  await verifyMfaCodeFlow(page, enrollmentCode);

  await expect(page).toHaveURL(`${origin}/courses`);

  await logout(page, { origin });
  await login(page, email, TEST_PASSWORD, { origin });
  await expect(page).toHaveURL(`${origin}/auth/mfa`);
  await expect(page.getByTestId(MFA_PAGE_HANDLES.PAGE)).toBeVisible();

  // The API checks TOTP with window 0 and rejects a second code from the same 30 s step for this
  // user, so the login code can only be verified once the step after enrollment has started.
  await expect.poll(() => generateTotpToken(secret), { timeout: 35_000 }).not.toBe(enrollmentCode);
  await verifyMfaCodeFlow(page, generateTotpToken(secret));

  await expect(page).toHaveURL(`${origin}/dashboard`);
});
