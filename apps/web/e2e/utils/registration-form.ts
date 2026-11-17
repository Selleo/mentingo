import type { FixtureApiClient } from "./api-client";
import type {
  GetAdminRegistrationFormResponse,
  UpdateRegistrationFormBody,
} from "~/api/generated-api";

type RegistrationField = GetAdminRegistrationFormResponse["data"]["fields"][number];

export const getRegistrationForm = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetAdminRegistrationForm();

  return response.data.data;
};

export const findRegistrationFieldByLabel = async (apiClient: FixtureApiClient, label: string) => {
  const form = await getRegistrationForm(apiClient);

  return form.fields.find((field) => field.label.en?.includes(label));
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

/** The update endpoint keeps fields missing from the body, so fields added by a test are archived. */
export const restoreRegistrationForm = async (
  apiClient: FixtureApiClient,
  originalFields: RegistrationField[],
) => {
  const originalFieldIds = new Set(originalFields.map((field) => field.id));
  const { fields: currentFields } = await getRegistrationForm(apiClient);
  const addedFields = currentFields
    .filter((field) => !originalFieldIds.has(field.id))
    .map((field) => ({ ...field, archived: true }));

  await apiClient.api.settingsControllerUpdateRegistrationForm(
    toUpdateRegistrationFormBody([...originalFields, ...addedFields]),
  );
};
