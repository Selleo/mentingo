import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";

import type { FixtureApiClient } from "../../utils/api-client";
import type { Page } from "@playwright/test";
import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

type GlobalSettings = GetPublicGlobalSettingsResponse["data"];
type ImageSetting = {
  field: keyof Pick<
    GlobalSettings,
    | "platformLogoS3Key"
    | "platformSimpleLogoS3Key"
    | "loginBackgroundImageS3Key"
    | "certificateBackgroundImage"
  >;
  inputHandle: string;
  name: string;
  remove: (apiClient: FixtureApiClient) => Promise<void>;
  removeHandle: string;
};

const imageSettings: ImageSetting[] = [
  {
    name: "platform logo",
    field: "platformLogoS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.PLATFORM_LOGO_REMOVE,
    remove: async (apiClient) => {
      await apiClient.api.settingsControllerUpdatePlatformLogo({ logo: null });
    },
  },
  {
    name: "simple platform logo",
    field: "platformSimpleLogoS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.PLATFORM_SIMPLE_LOGO_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.PLATFORM_SIMPLE_LOGO_REMOVE,
    remove: async (apiClient) => {
      await apiClient.api.settingsControllerUpdatePlatformSimpleLogo({ logo: null });
    },
  },
  {
    name: "login background image",
    field: "loginBackgroundImageS3Key",
    inputHandle: SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.LOGIN_BACKGROUND_REMOVE,
    remove: async (apiClient) => {
      await apiClient.api.settingsControllerUpdateLoginBackground({ "login-background": null });
    },
  },
  {
    name: "certificate background image",
    field: "certificateBackgroundImage",
    inputHandle: SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_INPUT,
    removeHandle: SETTINGS_PAGE_HANDLES.CERTIFICATE_BACKGROUND_REMOVE,
    remove: async (apiClient) => {
      await apiClient.api.settingsControllerUpdateCertificateBackground({
        "certificate-background": null,
      });
    },
  },
];

const openPlatformCustomizationSettings = async (page: Page) => {
  await openSettingsPageFlow(page);
  await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
  await expect(
    page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_CONTENT),
  ).toBeVisible();
};

const getGlobalSettings = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};

for (const imageSetting of imageSettings) {
  test(`admin can upload and remove ${imageSetting.name}`, async ({
    apiClient,
    cleanup,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      cleanup.add(async () => imageSetting.remove(apiClient));

      await openPlatformCustomizationSettings(page);
      await page
        .getByTestId(imageSetting.inputHandle)
        .setInputFiles(CURRICULUM_TEST_DATA.files.image);

      await expect
        .poll(async () => Boolean((await getGlobalSettings(apiClient))[imageSetting.field]))
        .toBe(true);

      await expect(page.getByTestId(imageSetting.removeHandle)).toBeVisible();
      await page.getByTestId(imageSetting.removeHandle).click();

      await expect
        .poll(async () => (await getGlobalSettings(apiClient))[imageSetting.field])
        .toBeNull();
    });
  });
}

test("admin can change theme colors and see them after reload", async ({
  apiClient,
  cleanup,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openPlatformCustomizationSettings(page);

    const originalPrimary = await page
      .getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT)
      .inputValue();
    const originalContrast = await page
      .getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT)
      .inputValue();
    const targetPrimary = "2563eb";
    const targetContrast = "ffffff";

    cleanup.add(async () => {
      await apiClient.api.settingsControllerUpdateColorSchema({
        primaryColor: `#${originalPrimary}`,
        contrastColor: `#${originalContrast}`,
      });
    });

    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT).fill(targetPrimary);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT).fill(targetContrast);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_SAVE).click();

    await expect
      .poll(async () => {
        const settings = await getGlobalSettings(apiClient);

        return {
          primaryColor: settings.primaryColor,
          contrastColor: settings.contrastColor,
        };
      })
      .toEqual({
        primaryColor: `#${targetPrimary}`,
        contrastColor: `#${targetContrast}`,
      });

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT)).toHaveValue(
      targetPrimary,
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT)).toHaveValue(
      targetContrast,
    );
  });
});

test("theme color cancel restores the last saved colors without persisting draft changes", async ({
  apiClient,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openPlatformCustomizationSettings(page);

    const originalPrimary = await page
      .getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT)
      .inputValue();
    const originalContrast = await page
      .getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT)
      .inputValue();
    const draftPrimary = originalPrimary === "111827" ? "0f766e" : "111827";
    const draftContrast = originalContrast === "ffffff" ? "f8fafc" : "ffffff";

    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT).fill(draftPrimary);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT).fill(draftContrast);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CANCEL).click();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT)).toHaveValue(
      originalPrimary,
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT)).toHaveValue(
      originalContrast,
    );

    const settings = await getGlobalSettings(apiClient);

    expect(settings.primaryColor?.toLowerCase() ?? `#${originalPrimary}`).not.toBe(
      `#${draftPrimary}`,
    );
    expect(settings.contrastColor?.toLowerCase() ?? `#${originalContrast}`).not.toBe(
      `#${draftContrast}`,
    );
  });
});
