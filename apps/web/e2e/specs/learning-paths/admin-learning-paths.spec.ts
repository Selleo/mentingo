import { USER_ROLE } from "~/config/userRoles";

import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_SETTINGS_HANDLES,
  LEARNING_PATH_SETTINGS_TAB_PARAM,
  LEARNING_PATH_SETTINGS_TABS,
  LEARNING_PATH_TRAIL_HANDLES,
  LEARNING_PATH_TRAIL_STOP_STATUSES,
  LEARNING_PATHS_PAGE_HANDLES,
} from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { addCoursesToLearningPathFlow } from "../../flows/learning-paths/add-courses-to-learning-path.flow";
import { createLearningPathFlow } from "../../flows/learning-paths/create-learning-path.flow";
import { editLearningPathDescriptionFlow } from "../../flows/learning-paths/edit-learning-path-description.flow";
import { moveTrailCourseForwardFlow } from "../../flows/learning-paths/move-trail-course-forward.flow";
import {
  openLearningPathSettingsFlow,
  openLearningPathSettingsTabFlow,
} from "../../flows/learning-paths/open-learning-path-settings-tab.flow";
import { openLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { removeCourseFromTrailFlow } from "../../flows/learning-paths/remove-course-from-trail.flow";

import {
  arrangeLearningPath,
  createLearningPathTestPrefix,
  enableLearningPathsForWorkerTenant,
} from "./learning-paths-test-helpers";

import type { LearningPathFactory } from "../../factories/learning-path.factory";

const getLearningPathCourseIds = async (
  learningPathFactory: LearningPathFactory,
  learningPathId: string,
) => {
  const learningPath = await learningPathFactory.getById(learningPathId);

  return learningPath.courses.map((course) => course.courseId);
};

test.describe("admin development paths", () => {
  test("admin can create a development path in the create dialog", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const learningPathFactory = factories.createLearningPathFactory();
    const prefix = createLearningPathTestPrefix("create");
    const title = `${prefix}-title`;
    const description = `${prefix} description`;

    await enableLearningPathsForWorkerTenant({ apiClient, withWorkerPage });

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      cleanup.add(async () => {
        await withWorkerPage(USER_ROLE.admin, async () => {
          const createdLearningPath = await learningPathFactory.findByTitle(title);
          if (createdLearningPath) await learningPathFactory.delete(createdLearningPath.id);
        });
      });

      await openLearningPathsPageFlow(page, prefix);
      await createLearningPathFlow(page, { title, description });

      await expect
        .poll(async () => (await learningPathFactory.findByTitle(title))?.description ?? null)
        .toBe(description);

      const createdLearningPath = await learningPathFactory.findByTitle(title);
      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(createdLearningPath!.id));

      await expect(card).toBeVisible();
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.TITLE)).toHaveText(title);
      await expect(card.getByTestId(LEARNING_PATH_CARD_HANDLES.DESCRIPTION)).toHaveText(
        description,
      );
    });
  });

  test("admin can add several courses at once from the add courses dialog", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const learningPathFactory = factories.createLearningPathFactory();
    const { prefix, learningPath, extraCourses } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("add-courses"),
      courseCount: 0,
      extraCourseCount: 2,
    });
    const extraCourseIds = extraCourses.map((course) => course.id);

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);
      await addCoursesToLearningPathFlow(page, learningPath.id, extraCourseIds);

      for (const courseId of extraCourseIds) {
        await expect(page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(courseId))).toBeVisible();
      }

      await expect
        .poll(async () => getLearningPathCourseIds(learningPathFactory, learningPath.id))
        .toEqual(extraCourseIds);
    });
  });

  test("admin can remove a course from the trail", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const learningPathFactory = factories.createLearningPathFactory();
    const { prefix, learningPath, pathCourses } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("remove-course"),
    });
    const [removedCourse, keptCourse] = pathCourses;

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);
      await removeCourseFromTrailFlow(page, removedCourse.id);

      await expect(
        page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(removedCourse.id)),
      ).toBeHidden();
      await expect(page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(keptCourse.id))).toBeVisible();

      await expect
        .poll(async () => getLearningPathCourseIds(learningPathFactory, learningPath.id))
        .toEqual([keptCourse.id]);
    });
  });

  test("admin can reorder trail courses with the drag handle", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const learningPathFactory = factories.createLearningPathFactory();
    const { prefix, learningPath, pathCourses } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("reorder"),
    });
    const [firstCourse, secondCourse] = pathCourses;

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);
      await moveTrailCourseForwardFlow(page, firstCourse.id);

      await expect
        .poll(async () => getLearningPathCourseIds(learningPathFactory, learningPath.id))
        .toEqual([secondCourse.id, firstCourse.id]);
    });
  });

  test("admin sees trail courses without learner progress", async ({
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
      prefix: createLearningPathTestPrefix("admin-trail"),
    });

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);

      for (const course of pathCourses) {
        const stop = page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.stop(course.id));

        await expect(stop).toHaveAttribute(
          "data-status",
          LEARNING_PATH_TRAIL_STOP_STATUSES.NEUTRAL,
        );
        await expect(stop).toHaveAttribute("data-openable", "true");
      }

      await expect(page.getByTestId(LEARNING_PATH_TRAIL_HANDLES.ADD_COURSE_BUTTON)).toBeVisible();
    });
  });

  test("admin can edit the path description inline", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    const learningPathFactory = factories.createLearningPathFactory();
    const { prefix, learningPath } = await arrangeLearningPath({
      apiClient,
      cleanup,
      factories,
      withWorkerPage,
      prefix: createLearningPathTestPrefix("description"),
      courseCount: 0,
    });
    const updatedDescription = `${prefix} updated description`;

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);
      await editLearningPathDescriptionFlow(page, learningPath.id, updatedDescription);

      await expect(
        page
          .getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id))
          .getByTestId(LEARNING_PATH_CARD_HANDLES.DESCRIPTION),
      ).toHaveText(updatedDescription);

      await expect
        .poll(async () => (await learningPathFactory.getById(learningPath.id)).description)
        .toBe(updatedDescription);
    });
  });

  test("admin keeps the selected settings tab in the URL", async ({
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
      prefix: createLearningPathTestPrefix("settings-tabs"),
      courseCount: 0,
    });

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);
      await openLearningPathSettingsTabFlow(
        page,
        learningPath.id,
        LEARNING_PATH_SETTINGS_TABS.CERTIFICATE,
      );

      await expect(page).toHaveURL(
        new RegExp(
          `${LEARNING_PATH_SETTINGS_TAB_PARAM}=${LEARNING_PATH_SETTINGS_TABS.CERTIFICATE}`,
        ),
      );

      await page.reload();
      await openLearningPathSettingsFlow(page, learningPath.id);

      await expect(
        page.getByTestId(
          LEARNING_PATH_SETTINGS_HANDLES.tab(LEARNING_PATH_SETTINGS_TABS.CERTIFICATE),
        ),
      ).toHaveAttribute("data-state", "active");
      await expect(
        page.getByTestId(LEARNING_PATH_SETTINGS_HANDLES.tab(LEARNING_PATH_SETTINGS_TABS.GENERAL)),
      ).toHaveAttribute("data-state", "inactive");
    });
  });

  test("admin sees the create tile after the last development path", async ({
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
      prefix: createLearningPathTestPrefix("create-tile"),
      courseCount: 0,
    });

    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLearningPathsPageFlow(page, prefix);

      await expect(
        page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPath.id)),
      ).toBeVisible();
      await expect(page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.CREATE_TILE)).toBeVisible();
    });
  });
});
