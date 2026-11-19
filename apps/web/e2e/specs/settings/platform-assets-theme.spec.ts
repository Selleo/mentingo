import { USER_ROLE } from "~/config/userRoles";

import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import { PLATFORM_LOGO_HANDLES } from "../../data/common/handles";
import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLoginPageFlow } from "../../flows/auth/open-login-page.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openPlatformCustomizationSettingsFlow } from "../../flows/settings/open-platform-customization-settings.flow";
import { openSettingsPageAtOriginFlow } from "../../flows/settings/open-settings-page.flow";
import { recordApiRequests } from "../../utils/api-requests";
import { getGlobalSettings } from "../../utils/global-settings";
import { captureOriginalPlatformImage, PLATFORM_IMAGE_SETTINGS } from "../../utils/platform-images";

const imageSettings = Object.values(PLATFORM_IMAGE_SETTINGS);

test("admin uploads branding images that visitors and users see, then removes them", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
}) => {
  const visitor = await createWorkspacePage();
  cleanup.add(() => visitor.context.close());

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    for (const imageSetting of imageSettings) {
      const originalImage = await captureOriginalPlatformImage(apiClient, imageSetting);
      cleanup.add(async () => {
        await imageSetting.update(apiClient, originalImage);
      });
    }

    await openPlatformCustomizationSettingsFlow(page);

    for (const imageSetting of imageSettings) {
      await page
        .getByTestId(imageSetting.inputHandle)
        .setInputFiles(CURRICULUM_TEST_DATA.files.image);
      await expect
        .poll(async () => Boolean((await getGlobalSettings(apiClient))[imageSetting.field]))
        .toBe(true);
    }

    await openLoginPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(PLATFORM_LOGO_HANDLES.CUSTOM)).toBeVisible();
    await expect(visitor.page.getByTestId(LOGIN_PAGE_HANDLES.BACKGROUND)).toBeVisible();

    // The navigation shows the simple logo (signet) below the 2xl breakpoint.
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 800 });
    await prepareNavigationPageFlow(page);
    await expect(page.getByTestId(PLATFORM_LOGO_HANDLES.CUSTOM_SIGNET)).toBeVisible();
    if (desktopViewport) await page.setViewportSize(desktopViewport);

    await openPlatformCustomizationSettingsFlow(page);

    for (const imageSetting of imageSettings) {
      await page.getByTestId(imageSetting.removeHandle).click();
      await expect
        .poll(async () => (await getGlobalSettings(apiClient))[imageSetting.field])
        .toBeNull();
    }

    await openLoginPageFlow(visitor.page);
    await expect(visitor.page.getByTestId(PLATFORM_LOGO_HANDLES.DEFAULT)).toBeVisible();
    await expect(visitor.page.getByTestId(PLATFORM_LOGO_HANDLES.CUSTOM)).toHaveCount(0);
    // The login page renders after the suspense global-settings query, which holds the background.
    await expect(visitor.page.getByTestId(LOGIN_PAGE_HANDLES.BACKGROUND)).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await prepareNavigationPageFlow(page);
    await expect(page.getByTestId(PLATFORM_LOGO_HANDLES.DEFAULT_SIGNET)).toBeVisible();
    await expect(page.getByTestId(PLATFORM_LOGO_HANDLES.CUSTOM_SIGNET)).toHaveCount(0);
  });
});

test("admin can change theme colors and see them after reload", async ({
  withIsolatedWorkerPage,
}) => {
  // The color endpoint cannot reset primary/contrast to their default (null), so the change is made on an isolated tenant.
  await withIsolatedWorkerPage(USER_ROLE.admin, async ({ apiClient, origin, page }) => {
    const targetPrimary = "2563eb";
    const targetContrast = "ffffff";

    await openSettingsPageAtOriginFlow(page, origin);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();

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
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
        ),
      )
      .toBe(`#${targetPrimary}`);
  });
});

test("theme color cancel restores the last saved colors without persisting draft changes", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openPlatformCustomizationSettingsFlow(page);

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
    const colorSaveRequests = recordApiRequests(page, "PATCH", "/api/settings/admin/color-schema");
    await page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CANCEL).click();

    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT)).toHaveValue(
      originalPrimary,
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT)).toHaveValue(
      originalContrast,
    );

    await page.reload();
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_PRIMARY_INPUT)).toHaveValue(
      originalPrimary,
    );
    await expect(page.getByTestId(SETTINGS_PAGE_HANDLES.THEME_CONTRAST_INPUT)).toHaveValue(
      originalContrast,
    );
    expect(colorSaveRequests).toHaveLength(0);
  });
});
