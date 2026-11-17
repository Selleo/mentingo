import { SETTINGS_PAGE_HANDLES } from "../data/settings/handles";

import type { FixtureApiClient } from "./api-client";
import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

type GlobalSettings = GetPublicGlobalSettingsResponse["data"];

export type PlatformImageSetting = {
  name: string;
  field: keyof Pick<
    GlobalSettings,
    | "platformLogoS3Key"
    | "platformSimpleLogoS3Key"
    | "loginBackgroundImageS3Key"
    | "certificateBackgroundImage"
  >;
  inputHandle: string;
  removeHandle: string;
  update: (apiClient: FixtureApiClient, file: File | null) => Promise<unknown>;
};

export const PLATFORM_IMAGE_SETTINGS = {
  platformLogo: {
    name: "platform logo",
    field: "platformLogoS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_REMOVE,
    update: (apiClient, file) => apiClient.api.settingsControllerUpdatePlatformLogo({ logo: file }),
  },
  simpleLogo: {
    name: "simple platform logo",
    field: "platformSimpleLogoS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.PLATFORM_SIMPLE_LOGO_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.PLATFORM_SIMPLE_LOGO_REMOVE,
    update: (apiClient, file) =>
      apiClient.api.settingsControllerUpdatePlatformSimpleLogo({ logo: file }),
  },
  loginBackground: {
    name: "login background image",
    field: "loginBackgroundImageS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_REMOVE,
    update: (apiClient, file) =>
      apiClient.api.settingsControllerUpdateLoginBackground({ "login-background": file }),
  },
  certificateBackground: {
    name: "certificate background image",
    field: "certificateBackgroundImage",
    inputHandle: SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_REMOVE,
    update: (apiClient, file) =>
      apiClient.api.settingsControllerUpdateCertificateBackground({
        "certificate-background": file,
      }),
  },
} as const satisfies Record<string, PlatformImageSetting>;

/**
 * Puts back the image a setting had before the test. The settings API returns signed URLs, so a
 * non-empty original is downloaded and uploaded again.
 */
export const restorePlatformImage = async (
  apiClient: FixtureApiClient,
  setting: PlatformImageSetting,
  originalUrl: string | null,
) => {
  if (!originalUrl) {
    await setting.update(apiClient, null);
    return;
  }

  const response = await fetch(originalUrl);
  if (!response.ok) throw new Error(`Could not download the original ${setting.name}.`);

  const type = response.headers.get("content-type") ?? "image/png";
  await setting.update(apiClient, new File([await response.arrayBuffer()], "original", { type }));
};
