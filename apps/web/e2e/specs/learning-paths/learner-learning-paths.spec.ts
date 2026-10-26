import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_TRAIL_HANDLES,
  LEARNING_PATH_TRAIL_STOP_STATUSES,
} from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";

import { arrangeLearningPath, createLearningPathTestPrefix } from "./learning-paths-test-helpers";

test.describe("learner development paths", () => {
  test("learner sees the sequential path progress on the trail and the progress bar", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const { prefix, learningPath, pathCourses } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("learner-trail"),
      learningPath: { sequenceEnabled: true },
      shouldEnrollStudent: true,
    });
    const [firstCourse, secondCourse] = pathCourses;

    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id));
      const firstStop = card.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(firstCourse.id));
      const secondStop = card.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(secondCourse.id));

      await expect(firstStop).toHaveAttribute(
        "data-status",
        LEARNING_PATH_TRAIL_STOP_STATUSES.NOT_STARTED,
      );
      await expect(firstStop).toHaveAttribute("data-current", "true");
      await expect(firstStop).toHaveAttribute("data-openable", "true");

      await expect(secondStop).toHaveAttribute(
        "data-status",
        LEARNING_PATH_TRAIL_STOP_STATUSES.LOCKED,
      );
      await expect(secondStop).toHaveAttribute("data-current", "false");
      await expect(secondStop).toHaveAttribute("data-openable", "false");

      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.PROGRESS_BAR)).toHaveAttribute(
        "aria-valuenow",
        "0",
      );
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLL_BUTTON)).toBeHidden();
    });
  });

  test("learner can continue the path with the next unlocked course", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const { prefix, learningPath, pathCourses } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("learner-continue"),
      learningPath: { sequenceEnabled: true },
      shouldEnrollStudent: true,
    });
    const [firstCourse] = pathCourses;

    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);

      await page
        .getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id))
        .getByTestId(LEARNING_PATH_CARD_HANDLES.CONTINUE_BUTTON)
        .click();

      await expect(page).toHaveURL(/\/course\/.+/);
      await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE)).toHaveText(
        firstCourse.title,
      );
    });
  });

  test("learner sees a course preview when hovering a trail course", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const { prefix, pathCourses } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("learner-preview"),
      shouldEnrollStudent: true,
    });
    const [firstCourse] = pathCourses;

    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);

      await page
        .getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(firstCourse.id))
        .getByRole("img", { name: firstCourse.title })
        .hover();

      const preview = page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.COURSE_PREVIEW);

      await expect(preview).toBeVisible();
      await expect(preview).toContainText(firstCourse.title);
      await expect(
        preview.getByTestId(LEARNING_PATH_TRAIL_HANDLES.COURSE_PREVIEW_OPEN_LINK),
      ).toHaveAttribute("href", `/course/${firstCourse.id}`);
    });
  });

  test("learner can enroll in a published development path", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const { prefix, learningPath } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("learner-enroll"),
    });

    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id));

      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.CONTINUE_BUTTON)).toBeHidden();
      await card.getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLL_BUTTON).click();

      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.ENROLL_BUTTON)).toBeHidden();
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.CONTINUE_BUTTON)).toBeVisible();
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.PROGRESS_BAR)).toBeVisible();
    });
  });
});
