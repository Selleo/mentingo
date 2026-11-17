import { USER_ROLE } from "~/config/userRoles";

import { REGISTER_PAGE_HANDLES } from "../../data/auth/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openRegisterPageFlow } from "../../flows/auth/open-register-page.flow";
import { addRegistrationFieldFlow } from "../../flows/settings/add-registration-field.flow";
import { openRegistrationFormBuilderFlow } from "../../flows/settings/open-registration-form-builder.flow";
import {
  findRegistrationFieldByLabel,
  getRegistrationForm,
  restoreRegistrationForm,
} from "../../utils/registration-form";

test("admin adds, archives and restores a registration checkbox that visitors see on the register page", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalForm = await getRegistrationForm(apiClient);
    const fieldIndex = originalForm.fields.length;
    const fieldLabel = `Settings registration ${Date.now()}`;

    cleanup.add(async () => restoreRegistrationForm(apiClient, originalForm.fields));

    const visitor = await createWorkspacePage();
    cleanup.add(() => visitor.context.close());

    await openRegistrationFormBuilderFlow(page, fieldIndex);
    await addRegistrationFieldFlow(page, fieldIndex, fieldLabel);

    await expect.poll(() => findRegistrationFieldByLabel(apiClient, fieldLabel)).toBeTruthy();
    const field = await findRegistrationFieldByLabel(apiClient, fieldLabel);
    if (!field) throw new Error(`Registration field "${fieldLabel}" was not saved.`);

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldEdit(fieldIndex)).click();
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldLabel(fieldIndex, "en")),
    ).toContainText(`${fieldLabel} en`);
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldLabel(fieldIndex, "pl")),
    ).toContainText(`${fieldLabel} pl`);
    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldRequired(fieldIndex)),
    ).toBeChecked();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldClose(fieldIndex)).click();

    const visitorField = visitor.page.getByTestId(REGISTER_PAGE_HANDLES.formField(field.id));

    await openRegisterPageFlow(visitor.page);
    await expect(visitorField).toContainText(`${fieldLabel} en`);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldArchive(fieldIndex)).click();
    await expect
      .poll(async () => (await findRegistrationFieldByLabel(apiClient, fieldLabel))?.archived)
      .toBe(true);

    await openRegisterPageFlow(visitor.page);
    await expect(visitorField).toHaveCount(0);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldRestore(fieldIndex)).click();
    await expect
      .poll(async () => (await findRegistrationFieldByLabel(apiClient, fieldLabel))?.archived)
      .toBe(false);

    await openRegisterPageFlow(visitor.page);
    await expect(visitorField).toBeVisible();
  });
});

test("registration form builder blocks saving when required labels are missing", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalForm = await getRegistrationForm(apiClient);
    const fieldIndex = originalForm.fields.length;

    cleanup.add(async () => restoreRegistrationForm(apiClient, originalForm.fields));

    await openRegistrationFormBuilderFlow(page, fieldIndex);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_ADD_FIELD).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_SAVE).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldEdit(fieldIndex)).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldLabelError(fieldIndex, "en")),
    ).toBeVisible();
    await expect
      .poll(async () => (await getRegistrationForm(apiClient)).fields.length)
      .toBe(originalForm.fields.length);
  });
});
