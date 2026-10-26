import { USER_ROLE } from "~/config/userRoles";

import { ENV_PAGE_HANDLES, ENV_SECRET_NAMES } from "../../data/environment/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEnvironmentPageFlow } from "../../flows/environment/open-environment-page.flow";
import { revealEnvSecretFlow } from "../../flows/environment/reveal-env-secret.flow";
import { saveEnvironmentFormFlow } from "../../flows/environment/save-environment-form.flow";
import { getEnvSecretValue, upsertEnvSecretValue } from "../../utils/environment";

const SECRET_NAME = ENV_SECRET_NAMES.SLACK_CLIENT_ID;
const STORED_VALUE = "e2e-slack-client-id-stored";
const UPDATED_VALUE = "e2e-slack-client-id-updated";

test.setTimeout(180 * 1000);

test("admin can load and update an env value", async ({ apiClient, cleanup, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalValue = await getEnvSecretValue(apiClient, SECRET_NAME);

    cleanup.add(async () => {
      await upsertEnvSecretValue(apiClient, SECRET_NAME, originalValue ?? "");
    });

    await upsertEnvSecretValue(apiClient, SECRET_NAME, STORED_VALUE);
    await openEnvironmentPageFlow(page);

    await expect(page.getByTestId(ENV_PAGE_HANDLES.input(SECRET_NAME))).toBeDisabled();

    const input = await revealEnvSecretFlow(page, SECRET_NAME);
    await expect(input).toHaveValue(STORED_VALUE);

    await input.fill(UPDATED_VALUE);
    await saveEnvironmentFormFlow(page);

    await expect
      .poll(async () => await getEnvSecretValue(apiClient, SECRET_NAME))
      .toBe(UPDATED_VALUE);

    await page.reload();
    await expect(page.getByTestId(ENV_PAGE_HANDLES.PAGE)).toBeVisible();

    const reloadedInput = await revealEnvSecretFlow(page, SECRET_NAME);
    await expect(reloadedInput).toHaveValue(UPDATED_VALUE);
  });
});
