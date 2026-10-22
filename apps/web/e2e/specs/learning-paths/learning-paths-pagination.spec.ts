import { LEARNING_PATH_STATUSES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATHS_PAGE_HANDLES,
} from "../../data/learning-paths/handles";
import { LEARNING_PATHS_TEST_DATA } from "../../data/learning-paths/learning-paths.data";
import { expect, test } from "../../fixtures/test.fixture";
import { openLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";

import {
  createLearningPathTestPrefix,
  enableLearningPathsForWorkerTenant,
} from "./learning-paths-test-helpers";

test("admin loads the next development paths page when scrolling to the end", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const learningPathFactory = factories.createLearningPathFactory();
  const prefix = createLearningPathTestPrefix("pagination");
  const learningPathCount = LEARNING_PATHS_TEST_DATA.pageSize + 1;

  await enableLearningPathsForWorkerTenant({ apiClient, withWorkerPage });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const learningPaths = await learningPathFactory.createMany(learningPathCount, (index) => ({
      title: `${prefix}-learning-path-${String(index + 1).padStart(2, "0")}`,
      status: LEARNING_PATH_STATUSES.PUBLISHED,
    }));
    const lastLearningPath = learningPaths[learningPaths.length - 1];

    cleanup.add(async () => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await learningPathFactory.deleteMany(learningPaths.map((learningPath) => learningPath.id));
      });
    });

    await openLearningPathsPageFlow(page, prefix);

    await expect(
      page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPaths[0].id)),
    ).toBeVisible();

    await page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.NEXT_PAGE_LOADER).scrollIntoViewIfNeeded();

    await expect(
      page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(lastLearningPath.id)),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid^="${LEARNING_PATH_CARD_HANDLES.CARD_PREFIX}"]`),
    ).toHaveCount(learningPathCount);
    await expect(page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.NEXT_PAGE_LOADER)).toBeHidden();
    await expect(page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.CREATE_TILE)).toBeVisible();
  });
});
