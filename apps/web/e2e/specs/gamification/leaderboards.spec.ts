import { LEADERBOARD_PERIODS, LEADERBOARD_VISIBILITY } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { LEADERBOARD_HANDLES } from "../../data/gamification/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { createFixtureFactories } from "../../factories";
import { expect, test } from "../../fixtures/test.fixture";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openSettingsPageFlow } from "../../flows/settings/open-settings-page.flow";
import {
  ensureLeaderboardFeatures,
  setLeaderboardFeatureState,
} from "../../utils/leaderboard-features";

import type { Page } from "@playwright/test";

const openLeaderboardPage = async (page: Page) => {
  await page.goto("/leaderboards");
  await expect(page.getByTestId(LEADERBOARD_HANDLES.PAGE)).toBeVisible();
};

const getScopeOptions = async (page: Page) => {
  await page.getByTestId(LEADERBOARD_HANDLES.SCOPE_SELECT).click();

  return page.getByRole("option");
};

test("admin enables leaderboards in platform settings and the navigation entry appears", async ({
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await ensureLeaderboardFeatures(workerTenantApiClient, {
      gamificationEnabled: true,
      leaderboardsEnabled: false,
    }),
  );

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await prepareNavigationPageFlow(page);
    await expect(page.getByTestId(NAVIGATION_HANDLES.LEADERBOARDS_LINK)).toHaveCount(0);

    await openSettingsPageFlow(page);
    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await expect(page.getByTestId(LEADERBOARD_HANDLES.SETTINGS_CARD)).toBeVisible();
    await page.getByTestId(LEADERBOARD_HANDLES.SETTINGS_ENABLED_SWITCH).click();

    await expect
      .poll(async () => {
        const response =
          await workerTenantApiClient.api.settingsControllerGetPublicGlobalSettings();
        return response.data.data.leaderboardsEnabled;
      })
      .toBe(true);

    await prepareNavigationPageFlow(page);
    await page.getByTestId(NAVIGATION_HANDLES.LEADERBOARDS_LINK).click();
    await expect(page).toHaveURL(/\/leaderboards$/);
    await expect(page.getByTestId(LEADERBOARD_HANDLES.PAGE)).toBeVisible();
  });
});

test("student ranks within their group and sees the organization only when leaderboards are public", async ({
  apiClient,
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await ensureLeaderboardFeatures(workerTenantApiClient, {
      gamificationEnabled: true,
      leaderboardsEnabled: true,
      leaderboardVisibility: LEADERBOARD_VISIBILITY.CLOSED,
    }),
  );

  const groupFactory = createFixtureFactories(workerTenantApiClient).createGroupFactory();
  const group = await groupFactory.create();
  cleanup.add(() => groupFactory.delete(group.id));

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const { data: currentUser } = await apiClient.api.authControllerCurrentUser();
    const student = currentUser.data;

    await workerTenantApiClient.api.userControllerAdminUpdateUser(
      { id: student.id },
      { groups: [group.id] },
    );

    await openLeaderboardPage(page);
    await expect(page.getByTestId(LEADERBOARD_HANDLES.SCOPE_SELECT)).toHaveText(group.name);

    // The student is the only group member, so they rank first and are highlighted.
    const ownEntry = page
      .getByTestId(LEADERBOARD_HANDLES.ENTRY)
      .filter({ hasText: `${student.firstName} ${student.lastName}` });
    await expect(ownEntry).toHaveAttribute("aria-current", "true");

    const closedScopeOptions = await getScopeOptions(page);
    await expect(closedScopeOptions).toHaveCount(1);
    await expect(closedScopeOptions.first()).toHaveText(group.name);
    await page.keyboard.press("Escape");

    await setLeaderboardFeatureState(workerTenantApiClient, {
      leaderboardVisibility: LEADERBOARD_VISIBILITY.PUBLIC,
    });

    await openLeaderboardPage(page);
    await expect(await getScopeOptions(page)).toHaveCount(2);
  });
});

test("custom period asks for a valid date range before loading the ranking", async ({
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await ensureLeaderboardFeatures(workerTenantApiClient, {
      gamificationEnabled: true,
      leaderboardsEnabled: true,
      leaderboardVisibility: LEADERBOARD_VISIBILITY.PUBLIC,
    }),
  );

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openLeaderboardPage(page);

    await page.getByTestId(LEADERBOARD_HANDLES.PERIOD_SELECT).click();
    await page.getByTestId(LEADERBOARD_HANDLES.periodOption(LEADERBOARD_PERIODS.CUSTOM)).click();

    const rangeHint = page.getByTestId(LEADERBOARD_HANDLES.RANGE_HINT);
    await expect(rangeHint).toBeVisible();

    // Days 8-22 never appear twice in a month view, so they are safe to pick by their number.
    const dayCell = (day: number) => page.getByRole("gridcell", { name: String(day), exact: true });

    await page.getByTestId(LEADERBOARD_HANDLES.FROM_INPUT).click();
    await dayCell(15).click();
    await expect(rangeHint).toBeVisible();

    // The end date cannot be set before the start date.
    await page.getByTestId(LEADERBOARD_HANDLES.TO_INPUT).click();
    await expect(dayCell(10)).toBeDisabled();
    await dayCell(20).click();
    await expect(rangeHint).toHaveCount(0);
    await expect(page.getByTestId(LEADERBOARD_HANDLES.ENTRY).first()).toBeVisible();
  });
});
