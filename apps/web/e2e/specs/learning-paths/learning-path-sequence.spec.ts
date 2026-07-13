import { USER_ROLE } from "~/config/userRoles";

import { LEARNING_PATH_CARD_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { openLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";
import { createSingleChoiceQuizLessonCourse } from "../learning/learning-test-helpers";

test("second course in a sequenced learning path unlocks only after the first is completed", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const learningPathFactory = factories.createLearningPathFactory();
  const learningPathEnrollmentFactory = factories.createLearningPathEnrollmentFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();

  const { courseId: firstCourseId } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `learning-path-sequence-first-${Date.now()}`,
    withWorkerPage,
  });
  const { courseId: secondCourseId } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `learning-path-sequence-second-${Date.now()}`,
    withWorkerPage,
  });

  let learningPathId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      await ensureLearningPathsEnabled(apiClient);

      const learningPath = await learningPathFactory.create({
        title: `learning-path-sequence-${Date.now()}`,
        sequenceEnabled: true,
      });
      learningPathId = learningPath.id;

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await learningPathFactory.delete(learningPathId);
          },
          { root: true },
        );
      });

      await learningPathFactory.addCourses(learningPathId, [firstCourseId, secondCourseId]);
      await learningPathFactory.update(learningPathId, { status: "published" });
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      const studentId = await enrollmentFactory.getCurrentUserId();

      await learningPathEnrollmentFactory.selfEnroll(learningPathId);
      await enrollmentFactory.selfEnroll(firstCourseId);

      await withWorkerPage(
        USER_ROLE.admin,
        async () => {
          const secondCourseEnrolledBeforeCompletion = await enrollmentFactory.getUser(
            secondCourseId,
            studentId,
          );
          expect(secondCourseEnrolledBeforeCompletion?.enrolledAt).toBeFalsy();
        },
        { root: true },
      );

      await openLearningPathsPageFlow(page);
      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));
      await expect(card).toBeVisible();
      await expect(
        card
          .getByTestId(LEARNING_PATH_CARD_HANDLES.courseRow(secondCourseId))
          .locator(`a[href*="/course/${secondCourseId}"]`),
      ).toHaveCount(0);

      await openCourseOverviewFlow(page, firstCourseId);
      await startLearningFlow(page);
      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);

      await withWorkerPage(
        USER_ROLE.admin,
        async () => {
          await expect
            .poll(
              async () => {
                const enrolledUser = await enrollmentFactory.getUser(secondCourseId, studentId);
                return Boolean(enrolledUser?.enrolledAt);
              },
              { timeout: 30_000 },
            )
            .toBe(true);
        },
        { root: true },
      );

      await openLearningPathsPageFlow(page);
      const updatedCard = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));
      await expect(updatedCard).toBeVisible();
      await expect(
        updatedCard
          .getByTestId(LEARNING_PATH_CARD_HANDLES.courseRow(secondCourseId))
          .locator(`a[href*="/course/${secondCourseId}"]`),
      ).toHaveCount(1);
    },
    { root: true },
  );
});
