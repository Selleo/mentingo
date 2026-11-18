import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import type { FixtureApiClient } from "./api-client";

export const getGlobalSettings = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};

/** MFA enforcement per role, in the shape `settingsControllerUpdateMfaEnforcedRoles` takes. */
export const getMfaEnforcedRoles = async (apiClient: FixtureApiClient) => {
  const enforcedRoles = new Set((await getGlobalSettings(apiClient)).MFAEnforcedRoles);

  return {
    admin: enforcedRoles.has(USER_ROLE.admin),
    student: enforcedRoles.has(USER_ROLE.student),
    content_creator: enforcedRoles.has(USER_ROLE.contentCreator),
    trainer: enforcedRoles.has(SYSTEM_ROLE_SLUGS.TRAINER),
  };
};
