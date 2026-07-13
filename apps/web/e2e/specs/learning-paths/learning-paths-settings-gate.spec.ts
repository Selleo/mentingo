import { USER_ROLE } from "~/config/userRoles";

import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("navigation reflects whether Learning Paths is enabled", async ({
  cleanup,
  withIsolatedWorkerPage,
}) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async ({ apiClient, origin, page }) => {
    const restoreLearningPaths = await ensureLearningPathsEnabled(apiClient, false);
    cleanup.add(restoreLearningPaths);

    await page.goto(`${origin}/progress`);
    await expect(page).toHaveURL(`${origin}/progress`);
    await expect(page.getByTestId(NAVIGATION_HANDLES.LEARNING_PATHS_LINK)).toHaveCount(0);

    await page.goto(`${origin}/development-paths`);
    await expect(page).toHaveURL(`${origin}/courses`);

    await ensureLearningPathsEnabled(apiClient, true);

    await page.goto(`${origin}/progress`);
    await expect(page).toHaveURL(`${origin}/progress`);
    await expect(page.getByTestId(NAVIGATION_HANDLES.LEARNING_PATHS_LINK)).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`${origin}/development-paths`);
    await expect(page).toHaveURL(`${origin}/development-paths`);
  });
});
