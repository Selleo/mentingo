import { LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { LIVE_TRAINING_LESSON_HANDLES } from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { createPublishedLearningCourse } from "../learning/learning-test-helpers";

test("student sees Live Training lesson state and file unlocks", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const liveTrainingFactory = factories.createLiveTrainingFactory();
  let liveTrainingId = "";
  let beforeResourceId = "";
  let afterResourceId = "";

  const { courseId, lessons } = await createPublishedLearningCourse({
    cleanup,
    factories,
    prefix: `learning-live-training-${Date.now()}`,
    withWorkerPage,
    buildLessons: async ({ chapterId, courseId: createdCourseId, curriculumFactory, prefix }) => {
      const liveTraining = await liveTrainingFactory.createOffline({
        title: `${prefix}-training`,
        description: "Training lesson state",
        location: "Lesson room",
      });

      liveTrainingId = liveTraining.id;
      cleanup.add(async () => {
        try {
          await liveTrainingFactory.delete(liveTrainingId);
        } catch {
          return;
        }
      });

      const beforeResource = await liveTrainingFactory.uploadResource(liveTrainingId, {
        filePath: CURRICULUM_TEST_DATA.files.documentPreview,
        contentType: "application/pdf",
        relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
      });
      const afterResource = await liveTrainingFactory.uploadResource(liveTrainingId, {
        filePath: CURRICULUM_TEST_DATA.files.presentationPreview,
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
      });
      const liveTrainingLesson = await curriculumFactory.createLiveTrainingLesson(createdCourseId, {
        chapterId,
        title: `${prefix}-lesson`,
        displayOrder: 1,
        liveTrainingId,
      });

      beforeResourceId = beforeResource.resourceId;
      afterResourceId = afterResource.resourceId;

      return { liveTrainingLesson };
    },
  });

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await factories.createEnrollmentFactory().selfEnroll(courseId);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await expect(page).toHaveURL(
        new RegExp(`/course/.+/lesson/${lessons.liveTrainingLesson.id}$`),
      );
      await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
        lessons.liveTrainingLesson.title,
      );
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.ROOT)).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.STATUS_PREVIEW)).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.LOCATION_NOTICE)).toContainText(
        "Lesson room",
      );
      await expect(
        page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.beforeFileCard(beforeResourceId)),
      ).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.AFTER_FILES_TAB)).toBeDisabled();
      await expect(
        page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.afterFileCard(afterResourceId)),
      ).toHaveCount(0);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      const session = await liveTrainingFactory.startSession(liveTrainingId);
      await liveTrainingFactory.endSession(liveTrainingId, session.id);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await page.goto(`/course/${courseId}/lesson/${lessons.liveTrainingLesson.id}`);
      await page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.AFTER_FILES_TAB).click();
      await expect(
        page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.afterFileCard(afterResourceId)),
      ).toBeVisible();
    },
    { root: true },
  );
});
