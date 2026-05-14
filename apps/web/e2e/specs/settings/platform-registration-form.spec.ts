import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

import type { FixtureApiClient } from "../../utils/api-client";
import type { Page } from "@playwright/test";
import type {
  GetAdminRegistrationFormResponse,
  UpdateRegistrationFormBody,
} from "~/api/generated-api";

type RegistrationField = GetAdminRegistrationFormResponse["data"]["fields"][number];

const openPlatformCustomizationSettings = async (page: Page) => {
  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
  await expect(
    page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_CONTENT),
  ).toBeVisible();
  await expect(
    page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_BUILDER_CARD),
  ).toBeVisible();
};

const getRegistrationForm = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetAdminRegistrationForm();

  return response.data.data;
};

const toUpdateRegistrationFormBody = (fields: RegistrationField[]): UpdateRegistrationFormBody => ({
  fields: fields.map((field, index) => ({
    id: field.id,
    type: "checkbox",
    label: field.label,
    required: field.required,
    archived: field.archived,
    displayOrder: index,
  })),
});

const restoreRegistrationForm = async (
  apiClient: FixtureApiClient,
  originalFields: RegistrationField[],
) => {
  await apiClient.api.settingsControllerUpdateRegistrationForm(
    toUpdateRegistrationFormBody(originalFields),
  );
};

const fillRegistrationFieldLabels = async (page: Page, index: number, baseLabel: string) => {
  for (const language of Object.values(SUPPORTED_LANGUAGES)) {
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldLabel(index, language))
      .fill(`${baseLabel} ${language}`);
  }
};

const addAndSaveRegistrationField = async (
  page: Page,
  apiClient: FixtureApiClient,
  index: number,
  baseLabel: string,
) => {
  await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_ADD_FIELD).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldEdit(index)).click();
  await fillRegistrationFieldLabels(page, index, baseLabel);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldRequired(index)).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldClose(index)).click();
  await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_SAVE).click();

  await expect
    .poll(async () => {
      const form = await getRegistrationForm(apiClient);

      return form.fields.some((field) => field.label.en?.includes(baseLabel));
    })
    .toBe(true);
};

test("admin can add and edit registration form checkbox labels and required state", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalForm = await getRegistrationForm(apiClient);
    const fieldIndex = originalForm.fields.length;
    const fieldLabel = `Settings registration ${Date.now()}`;

    cleanup.add(async () => restoreRegistrationForm(apiClient, originalForm.fields));

    await openPlatformCustomizationSettings(page);
    await addAndSaveRegistrationField(page, apiClient, fieldIndex, fieldLabel);

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

    await openPlatformCustomizationSettings(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_ADD_FIELD).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.REGISTRATION_FORM_SAVE).click();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldEdit(fieldIndex)).click();

    await expect(
      page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldLabelError(fieldIndex, "en")),
    ).toContainText(/\S/);
    await expect
      .poll(async () => (await getRegistrationForm(apiClient)).fields.length)
      .toBe(originalForm.fields.length);
  });
});

test("admin can archive and restore a persisted registration form field", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const originalForm = await getRegistrationForm(apiClient);
    const fieldIndex = originalForm.fields.length;
    const fieldLabel = `Settings archive ${Date.now()}`;

    cleanup.add(async () => restoreRegistrationForm(apiClient, originalForm.fields));

    await openPlatformCustomizationSettings(page);
    await addAndSaveRegistrationField(page, apiClient, fieldIndex, fieldLabel);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldArchive(fieldIndex)).click();
    await expect
      .poll(async () => {
        const form = await getRegistrationForm(apiClient);

        return form.fields.find((field) => field.label.en?.includes(fieldLabel))?.archived;
      })
      .toBe(true);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.registrationFormFieldRestore(fieldIndex)).click();
    await expect
      .poll(async () => {
        const form = await getRegistrationForm(apiClient);

        return form.fields.find((field) => field.label.en?.includes(fieldLabel))?.archived;
      })
      .toBe(false);
  });
});
