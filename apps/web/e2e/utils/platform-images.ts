import { SETTINGS_PAGE_HANDLES } from "../data/settings/handles";

import { getGlobalSettings } from "./global-settings";

import type { FixtureApiClient } from "./api-client";
import type { AxiosResponse } from "axios";
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
  /** Streams the current image through the API, so tests do not depend on the storage host. */
  download: (apiClient: FixtureApiClient) => Promise<AxiosResponse>;
};

export const PLATFORM_IMAGE_SETTINGS = {
  platformLogo: {
    name: "platform logo",
    field: "platformLogoS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_REMOVE,
    update: (apiClient, file) => apiClient.api.settingsControllerUpdatePlatformLogo({ logo: file }),
    download: (apiClient) =>
      apiClient.api.settingsControllerGetPlatformLogoImage({ format: "arraybuffer" }),
  },
  simpleLogo: {
    name: "simple platform logo",
    field: "platformSimpleLogoS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.PLATFORM_SIMPLE_LOGO_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.PLATFORM_SIMPLE_LOGO_REMOVE,
    update: (apiClient, file) =>
      apiClient.api.settingsControllerUpdatePlatformSimpleLogo({ logo: file }),
    download: (apiClient) =>
      apiClient.api.settingsControllerGetPlatformSimpleLogoImage({ format: "arraybuffer" }),
  },
  loginBackground: {
    name: "login background image",
    field: "loginBackgroundImageS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_REMOVE,
    update: (apiClient, file) =>
      apiClient.api.settingsControllerUpdateLoginBackground({ "login-background": file }),
    download: (apiClient) =>
      apiClient.api.settingsControllerGetLoginBackgroundImage({ format: "arraybuffer" }),
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
    download: (apiClient) =>
      apiClient.api.settingsControllerGetCertificateBackgroundImage({ format: "arraybuffer" }),
  },
} as const satisfies Record<string, PlatformImageSetting>;

/**
 * Reads the image a setting has before the test changes it, so cleanup can upload it again
 * (`null` when none is set; the download endpoint returns 404 then). The file name keeps an
 * extension because the API stores it in the key.
 */
export const captureOriginalPlatformImage = async (
  apiClient: FixtureApiClient,
  setting: PlatformImageSetting,
): Promise<File | null> => {
  const settings = await getGlobalSettings(apiClient);
  if (!settings[setting.field]) return null;

  const response = await setting.download(apiClient);
  const type = String(response.headers["content-type"] ?? "image/png").split(";")[0];
  const extension = type.split("/")[1]?.replace("+xml", "") ?? "png";

  return new File([response.data], `original.${extension}`, { type });
};
