import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATE_PREVIEW_HANDLES } from "../../data/certificates/handles";
import {
  LEARNING_PATH_CARD_HANDLES,
  LEARNING_PATH_CERTIFICATE_HANDLES,
} from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { waitForLearningPathCertificateFlow } from "../../flows/certificates/wait-for-certificate.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { openLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";
import { createSingleChoiceQuizLessonCourse } from "../learning/learning-test-helpers";

test("student completing all courses in a learning path unlocks the path certificate", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const learningPathFactory = factories.createLearningPathFactory();
  const learningPathEnrollmentFactory = factories.createLearningPathEnrollmentFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();
  const certificateFactory = factories.createCertificateFactory();

  const { courseId } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `learning-path-completion-${Date.now()}`,
    withWorkerPage,
  });

  let learningPathId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      await ensureLearningPathsEnabled(apiClient);

      const learningPath = await learningPathFactory.create({
        title: `learning-path-completion-${Date.now()}`,
        includesCertificate: true,
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

      await learningPathFactory.addCourses(learningPathId, [courseId]);
      await learningPathFactory.update(learningPathId, { status: "published" });
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ context, origin, page }) => {
      const studentId = await enrollmentFactory.getCurrentUserId();

      await learningPathEnrollmentFactory.selfEnroll(learningPathId);

      await withWorkerPage(
        USER_ROLE.admin,
        async () => {
          await expect
            .poll(
              async () => {
                const enrolledUser = await enrollmentFactory.getUser(courseId, studentId);
                return Boolean(enrolledUser?.enrolledAt);
              },
              { timeout: 30_000 },
            )
            .toBe(true);
        },
        { root: true },
      );
      if (!origin) throw new Error("Expected student page origin to resync the API client");
      await apiClient.syncFromContext(context, origin);

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);
      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);

      await expect
        .poll(async () => (await learningPathFactory.getById(learningPathId)).progress, {
          timeout: 30_000,
        })
        .toBe("completed");

      const certificateId = await waitForLearningPathCertificateFlow(certificateFactory, {
        learningPathId,
        userId: studentId,
      });

      await openLearningPathsPageFlow(page);

      const card = page.getByTestId(LEARNING_PATH_CARD_HANDLES.card(learningPathId));
      await expect(card.getByTestId(LEARNING_PATH_CERTIFICATE_HANDLES.BANNER)).toBeVisible();

      await card.getByTestId(LEARNING_PATH_CERTIFICATE_HANDLES.VIEW_BUTTON).click();

      const modal = page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.MODAL);
      await expect(modal).toBeVisible();

      await page.route("**/api/learning-path/certificates/download", async (route) => {
        await route.fulfill({
          body: Buffer.from("%PDF-1.4 fake certificate"),
          contentType: "application/pdf",
          headers: { "content-disposition": 'attachment; filename="certificate.pdf"' },
        });
      });

      const downloadResponse = page.waitForResponse((response) =>
        response.url().includes("/api/learning-path/certificates/download"),
      );

      await page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.DOWNLOAD_BUTTON).click();

      const response = await downloadResponse;
      expect(response.ok()).toBe(true);
      const requestBody = response.request().postDataJSON();
      expect(requestBody).toMatchObject({ certificateId, language: "en" });
    },
    { root: true },
  );
});
