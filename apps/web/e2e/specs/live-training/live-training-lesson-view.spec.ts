import { LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { expect, test } from "../../fixtures/test.fixture";
import { createPublishedLearningCourse } from "../learning/learning-test-helpers";

test("student sees Live Training lesson state and file unlocks", async ({
  apiClient,
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
    async () => {
      const enrollmentFactory = factories.createEnrollmentFactory();

      await enrollmentFactory.selfEnroll(courseId);
      const studentId = await enrollmentFactory.getCurrentUserId();

      await expect
        .poll(
          async () => {
            const courseResponse = await apiClient.api.courseControllerGetCourse({
              id: courseId,
              language: "en",
            });

            return courseResponse.data.data.enrolled ?? false;
          },
          { timeout: 15_000 },
        )
        .toBe(true);

      await expect
        .poll(
          async () => {
            try {
              const lessonResponse = await apiClient.api.lessonControllerGetLessonById(
                lessons.liveTrainingLesson.id,
                {
                  language: "en",
                  studentId,
                },
              );

              return lessonResponse.data.data.title;
            } catch {
              return null;
            }
          },
          { timeout: 15_000 },
        )
        .toBe(lessons.liveTrainingLesson.title);

      const lessonResponse = await apiClient.api.lessonControllerGetLessonById(
        lessons.liveTrainingLesson.id,
        {
          language: "en",
          studentId,
        },
      );

      expect(lessonResponse.data.data.liveTraining).toMatchObject({
        id: liveTrainingId,
        location: "Lesson room",
      });
      expect(
        lessonResponse.data.data.liveTraining?.materials.before.some(
          (material) => material.resourceId === beforeResourceId,
        ),
      ).toBe(true);
      expect(
        lessonResponse.data.data.liveTraining?.materials.after.some(
          (material) => material.resourceId === afterResourceId,
        ),
      ).toBe(false);
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
    async () => {
      const studentId = await factories.createEnrollmentFactory().getCurrentUserId();

      await expect
        .poll(
          async () => {
            const lessonResponse = await apiClient.api.lessonControllerGetLessonById(
              lessons.liveTrainingLesson.id,
              {
                language: "en",
                studentId,
              },
            );

            return lessonResponse.data.data.liveTraining?.materials.after.some(
              (material) => material.resourceId === afterResourceId,
            );
          },
          { timeout: 15_000 },
        )
        .toBe(true);
    },
    { root: true },
  );
});
