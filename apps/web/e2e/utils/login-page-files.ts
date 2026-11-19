import { CURRICULUM_TEST_DATA } from "../data/curriculum/curriculum.data";

import { readFixtureFile } from "./upload-file";

import type { FixtureApiClient } from "./api-client";

export const getLoginPageFiles = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetLoginPageFiles();

  return response.data.resources;
};

export const uploadLoginPageFile = async (apiClient: FixtureApiClient, name: string) => {
  const file = await readFixtureFile(CURRICULUM_TEST_DATA.files.documentPreview, "application/pdf");

  await apiClient.api.settingsControllerUpdateLoginPageFiles({ file, name });
};

export const removeLoginPageFilesByPrefix = async (apiClient: FixtureApiClient, prefix: string) => {
  const resources = await getLoginPageFiles(apiClient);

  for (const resource of resources.filter((item) => item.name.startsWith(prefix))) {
    await apiClient.api.settingsControllerDeleteLoginPageFile(resource.id);
  }
};
