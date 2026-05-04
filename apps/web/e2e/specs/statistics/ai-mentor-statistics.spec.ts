import { USER_ROLE } from "~/config/userRoles";

import { COURSE_STATISTICS_HANDLES } from "../../data/statistics/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseStatisticsTabFlow } from "../../flows/statistics/open-course-statistics-tab.flow";
import { openCourseStatisticsFlow } from "../../flows/statistics/open-course-statistics.flow";
import { createAiMentorLessonCourse } from "../learning/learning-test-helpers";

test("admin can view AI mentor statistics after prepared mentor progress", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId, lessons } = await createAiMentorLessonCourse({
    cleanup,
    factories,
    prefix: `statistics-ai-mentor-${Date.now()}`,
    shouldKeepCourseAfterTest: () => true,
    withWorkerPage,
  });
  const { aiMentorLesson } = lessons;

  let studentId = "";

  await withWorkerPage(
    USER_ROLE.student,
    async () => {
      await enrollmentFactory.selfEnroll(courseId);
      studentId = await enrollmentFactory.getCurrentUserId();
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await apiClient.prepareAiMentorStatisticsProgress({
        language: "en",
        lessonId: aiMentorLesson.id,
        studentId,
      });

      await expect
        .poll(
          async () => {
            const response = await apiClient.api.courseControllerGetCourseStudentsAiMentorResults(
              courseId,
              {
                language: "en",
                perPage: 100,
              },
            );

            return response.data.data.some(
              (row) => row.studentId === studentId && row.lessonId === aiMentorLesson.id,
            );
          },
          { timeout: 30_000 },
        )
        .toBe(true);

      await openCourseStatisticsFlow(page, courseId);
      await openCourseStatisticsTabFlow(page, "aiMentorResults");

      await expect(
        page.getByTestId(
          COURSE_STATISTICS_HANDLES.aiMentorResultsRow(studentId, aiMentorLesson.id),
        ),
      ).toBeVisible();
      await expect(
        page.getByTestId(
          COURSE_STATISTICS_HANDLES.aiMentorResultsPreviewButton(studentId, aiMentorLesson.id),
        ),
      ).toBeVisible();

      await page.getByTestId(COURSE_STATISTICS_HANDLES.AI_MENTOR_LESSON_FILTER).click();
      await page
        .getByTestId(COURSE_STATISTICS_HANDLES.aiMentorLessonFilterOption(aiMentorLesson.id))
        .click();
      await expect(
        page.getByTestId(
          COURSE_STATISTICS_HANDLES.aiMentorResultsRow(studentId, aiMentorLesson.id),
        ),
      ).toBeVisible();
    },
    { root: true },
  );
});
