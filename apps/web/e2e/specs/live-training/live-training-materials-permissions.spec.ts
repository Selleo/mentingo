import { LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import {
  LIVE_TRAINING_HANDLES,
  LIVE_TRAINING_LESSON_HANDLES,
} from "../../data/live-training/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openLiveTrainingFlow } from "../../flows/live-training/open-live-training.flow";
import { createPublishedLearningCourse } from "../learning/learning-test-helpers";

test("Live Training materials, hosts and sessions are gated by role and session state", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const liveTrainingFactory = factories.createLiveTrainingFactory();
  const prefix = `live-training-materials-${Date.now()}`;
  let liveTrainingId = "";
  let beforeResourceId = "";
  let afterResourceId = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const liveTraining = await liveTrainingFactory.createOffline({
      title: `${prefix}-training`,
      description: "Materials visibility",
      location: "Lesson room",
    });
    liveTrainingId = liveTraining.id;
    // Registered before the course, so it runs after the course (and its lesson link) is gone.
    cleanup.add(() => liveTrainingFactory.delete(liveTraining.id));

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
    beforeResourceId = beforeResource.resourceId;
    afterResourceId = afterResource.resourceId;
  });

  const { courseId, lessons } = await createPublishedLearningCourse({
    cleanup,
    factories,
    prefix,
    root: false,
    withWorkerPage,
    buildLessons: async ({ chapterId, courseId: createdCourseId, curriculumFactory }) => ({
      liveTrainingLesson: await curriculumFactory.createLiveTrainingLesson(createdCourseId, {
        chapterId,
        title: `${prefix}-lesson`,
        displayOrder: 1,
        liveTrainingId,
      }),
    }),
  });
  const lessonUrl = `/course/${courseId}/lesson/${lessons.liveTrainingLesson.id}`;

  await test.step("admin sees every file and the sessions tab", async () => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      await openLiveTrainingFlow(page, liveTrainingId);
      await page.getByTestId(LIVE_TRAINING_HANDLES.FILES_TAB).click();
      await expect(
        page.getByTestId(LIVE_TRAINING_HANDLES.beforeFileCard(beforeResourceId)),
      ).toBeVisible();
      await expect(
        page.getByTestId(LIVE_TRAINING_HANDLES.afterFileCard(afterResourceId)),
      ).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_TAB)).toBeVisible();
    });
  });

  await test.step("content creator cannot assign additional hosts", async () => {
    await withWorkerPage(USER_ROLE.contentCreator, async ({ page }) => {
      await openLiveTrainingFlow(page, liveTrainingId);
      await page.getByTestId(LIVE_TRAINING_HANDLES.OVERVIEW_TAB).click();
      await expect(page.getByTestId(LIVE_TRAINING_HANDLES.ADD_HOST_BUTTON)).toHaveCount(0);
    });
  });

  await test.step("student sees only the before-session files before the session", async () => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await factories.createEnrollmentFactory().selfEnroll(courseId);

      await openLiveTrainingFlow(page, liveTrainingId);
      await expect(page.getByTestId(LIVE_TRAINING_HANDLES.SESSIONS_TAB)).toHaveCount(0);
      await page.getByTestId(LIVE_TRAINING_HANDLES.FILES_TAB).click();
      await expect(
        page.getByTestId(LIVE_TRAINING_HANDLES.beforeFileCard(beforeResourceId)),
      ).toBeVisible();
      await expect(
        page.getByTestId(LIVE_TRAINING_HANDLES.AFTER_FILES_LOCKED_MESSAGE),
      ).toBeVisible();
      await expect(
        page.getByTestId(LIVE_TRAINING_HANDLES.afterFileCard(afterResourceId)),
      ).toHaveCount(0);

      await page.goto(lessonUrl);
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.ROOT)).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.LOCATION_NOTICE)).toContainText(
        "Lesson room",
      );
      await expect(
        page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.beforeFileCard(beforeResourceId)),
      ).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.AFTER_FILES_TAB)).toBeDisabled();
    });
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    const session = await liveTrainingFactory.startSession(liveTrainingId);
    await liveTrainingFactory.endSession(liveTrainingId, session.id);
  });

  await test.step("student sees the after-session files once the session ended", async () => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await openLiveTrainingFlow(page, liveTrainingId);
      await page.getByTestId(LIVE_TRAINING_HANDLES.FILES_TAB).click();
      await expect(
        page.getByTestId(LIVE_TRAINING_HANDLES.afterFileCard(afterResourceId)),
      ).toBeVisible();
      await expect(page.getByTestId(LIVE_TRAINING_HANDLES.AFTER_FILES_LOCKED_MESSAGE)).toHaveCount(
        0,
      );

      await page.goto(lessonUrl);
      await page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.AFTER_FILES_TAB).click();
      await expect(
        page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.afterFileCard(afterResourceId)),
      ).toBeVisible();
    });
  });
});
