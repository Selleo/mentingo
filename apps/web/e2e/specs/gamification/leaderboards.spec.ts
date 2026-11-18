import { LEADERBOARD_PERIODS, LEADERBOARD_VISIBILITY } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DATE_PICKER_HANDLES } from "../../data/common/handles";
import { LEADERBOARD_HANDLES } from "../../data/gamification/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { createFixtureFactories } from "../../factories";
import { expect, test } from "../../fixtures/test.fixture";
import {
  openLeaderboardPageFlow,
  openLeaderboardScopeOptionsFlow,
} from "../../flows/gamification/open-leaderboard-page.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
import { openFeaturesSettingsFlow } from "../../flows/settings/open-features-settings.flow";
import {
  ensureLeaderboardFeatures,
  setLeaderboardFeatureState,
} from "../../utils/leaderboard-features";

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

    await openFeaturesSettingsFlow(page);
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

    await openLeaderboardPageFlow(page);
    await expect(page.getByTestId(LEADERBOARD_HANDLES.SCOPE_SELECT)).toHaveText(group.name);

    // The student is the only group member, so they rank first and are highlighted.
    const ownEntry = page
      .getByTestId(LEADERBOARD_HANDLES.ENTRY)
      .filter({ hasText: `${student.firstName} ${student.lastName}` });
    await expect(ownEntry).toHaveAttribute("aria-current", "true");

    const closedScopeOptions = await openLeaderboardScopeOptionsFlow(page);
    await expect(closedScopeOptions).toHaveCount(1);
    await expect(closedScopeOptions.first()).toHaveText(group.name);
    await page.keyboard.press("Escape");

    await setLeaderboardFeatureState(workerTenantApiClient, {
      leaderboardVisibility: LEADERBOARD_VISIBILITY.PUBLIC,
    });

    await openLeaderboardPageFlow(page);
    await expect(await openLeaderboardScopeOptionsFlow(page)).toHaveCount(2);
  });
});

test("custom period asks for a valid date range before loading the ranking", async ({
  apiClient,
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
    const { data: currentUser } = await apiClient.api.authControllerCurrentUser();
    const student = currentUser.data;

    await openLeaderboardPageFlow(page);

    // Both pickers open on the browser's current month; take it in the browser's timezone.
    // Any range works: learners without XP in it are still ranked.
    const currentMonth = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    });
    const fromDay = `${currentMonth}-15`;
    const dayBeforeFrom = `${currentMonth}-10`;
    const toDay = `${currentMonth}-20`;

    await page.getByTestId(LEADERBOARD_HANDLES.PERIOD_SELECT).click();
    await page.getByTestId(LEADERBOARD_HANDLES.periodOption(LEADERBOARD_PERIODS.CUSTOM)).click();

    const rangeHint = page.getByTestId(LEADERBOARD_HANDLES.RANGE_HINT);
    await expect(rangeHint).toBeVisible();

    await page.getByTestId(LEADERBOARD_HANDLES.FROM_INPUT).click();
    await page
      .getByTestId(DATE_PICKER_HANDLES.day(LEADERBOARD_HANDLES.FROM_INPUT, fromDay))
      .click();
    await expect(rangeHint).toBeVisible();

    // The end date cannot be set before the start date.
    await page.getByTestId(LEADERBOARD_HANDLES.TO_INPUT).click();
    await expect(
      page.getByRole("gridcell").filter({
        has: page.getByTestId(DATE_PICKER_HANDLES.day(LEADERBOARD_HANDLES.TO_INPUT, dayBeforeFrom)),
      }),
    ).toBeDisabled();
    await page.getByTestId(DATE_PICKER_HANDLES.day(LEADERBOARD_HANDLES.TO_INPUT, toDay)).click();

    await expect(rangeHint).toHaveCount(0);
    await expect(
      page
        .getByTestId(LEADERBOARD_HANDLES.ENTRY)
        .filter({ hasText: `${student.firstName} ${student.lastName}` }),
    ).toHaveAttribute("aria-current", "true");
  });
});
